import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const formatNumberForDB = (num) => {
    const number = parseFloat(num);
    if (isNaN(number)) return "0";
    const fixedNum = number.toFixed(2);
    return fixedNum.endsWith('.00') ? String(parseInt(number, 10)) : Number(fixedNum).toString();
};

export const useSimplifiedFoodForm = ({ onFoodActionComplete, isClientRequest, userId, foodToCreate }) => {
    const { toast } = useToast();
    const { user: authUser } = useAuth();
    const [state, setState] = useState({
        allVitamins: [],
        allMinerals: [],
        allSensitivities: [],
        allStores: [],
        allFoodGroups: [],
        isLoading: true,
    });
    const [formState, setFormState] = useState({
        formData: { name: '', food_unit: 'gramos', proteins: '', total_carbs: '', total_fats: '', salt: '', carbs_sugars: '', fibers: '', fats_saturated: '', fats_monounsaturated: '', fats_polyunsaturated: '' },
        selectedVitamins: [],
        selectedMinerals: [],
        selectedSensitivities: [],
        selectedStores: [],
        selectedFoodGroups: [],
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMineralsOpen, setIsMineralsOpen] = useState(false);

    useEffect(() => {
        if(foodToCreate) {
             setFormState(prev => ({
                ...prev,
                formData: {
                    ...prev.formData,
                    name: foodToCreate.name,
                }
            }));
        }
    }, [foodToCreate]);

    const fetchInitialData = useCallback(async () => {
        setState(prevState => ({ ...prevState, isLoading: true }));
        try {
            const [vitaminsRes, mineralsRes, sensitivitiesRes, storesRes, foodGroupsRes] = await Promise.all([
                supabase.from('vitamins').select('*').order('name'),
                supabase.from('minerals').select('*').order('name'),
                supabase.from('sensitivities').select('*').order('name'),
                supabase.from('stores').select('*').order('name'),
                supabase.from('food_groups').select('*').order('name'),
            ]);

            const checkError = (res, name) => {
                if (res.error) throw new Error(`Error fetching ${name}: ${res.error.message}`);
                return res.data;
            };

            setState({
                allVitamins: checkError(vitaminsRes, 'vitamins'),
                allMinerals: checkError(mineralsRes, 'minerals'),
                allSensitivities: checkError(sensitivitiesRes, 'sensitivities'),
                allStores: checkError(storesRes, 'stores'),
                allFoodGroups: checkError(foodGroupsRes, 'food groups'),
                isLoading: false,
            });
        } catch (error) {
            toast({ title: 'Error', description: `No se pudieron cargar los datos iniciales. ${error.message}`, variant: 'destructive' });
            setState(prevState => ({ ...prevState, isLoading: false }));
        }
    }, [toast]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const sodiumId = useMemo(() => state.allMinerals.find(m => m.name.toLowerCase() === 'sodio')?.id, [state.allMinerals]);

    const handleSaltChange = useCallback((saltGrams) => {
        setFormState(prev => {
          const salt = parseFloat(saltGrams) || 0;
          const sodiumMg = salt * 400;
          
          let newSelectedMinerals = [...prev.selectedMinerals];
          const sodiumIndex = newSelectedMinerals.findIndex(m => m.mineral_id === sodiumId);

          if (sodiumIndex > -1) {
            newSelectedMinerals[sodiumIndex] = { ...newSelectedMinerals[sodiumIndex], mg_per_100g: formatNumberForDB(sodiumMg) };
          } else if (sodiumId && salt > 0) {
            newSelectedMinerals.push({ mineral_id: sodiumId, mg_per_100g: formatNumberForDB(sodiumMg) });
            setIsMineralsOpen(true);
          }
          
          return {
            ...prev,
            formData: { ...prev.formData, salt: saltGrams },
            selectedMinerals: newSelectedMinerals
          };
        });
    }, [sodiumId]);

    const handleSodiumChange = useCallback((sodiumMg) => {
        const sodium = parseFloat(sodiumMg) || 0;
        const saltGrams = sodium / 400;
        setFormState(prev => ({
          ...prev,
          formData: { ...prev.formData, salt: formatNumberForDB(saltGrams) },
        }));
    }, []);

    const handleMineralsChange = useCallback((newMinerals) => {
        const sodiumMineral = newMinerals.find(m => m.mineral_id === sodiumId);
        const oldSodiumMineral = formState.selectedMinerals.find(m => m.mineral_id === sodiumId);

        if (sodiumMineral?.mg_per_100g !== oldSodiumMineral?.mg_per_100g) {
          handleSodiumChange(sodiumMineral?.mg_per_100g);
        }
        
        setFormState(prev => ({ ...prev, selectedMinerals: newMinerals }));
    }, [sodiumId, formState.selectedMinerals, handleSodiumChange]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, formData: { ...prev.formData, [name]: value } }));
    };

    const handleSelectChange = (name, value) => {
        setFormState(prev => ({ ...prev, formData: { ...prev.formData, [name]: value } }));
    };

    const formHandlers = {
        handleChange: (e) => {
            const { name, value } = e.target;
            if (name === 'salt') {
                handleSaltChange(value);
            } else {
                handleChange(e);
            }
        },
        handleSelectChange,
        setSelectedVitamins: (value) => setFormState(prev => ({ ...prev, selectedVitamins: value })),
        setSelectedMinerals: handleMineralsChange,
        setSelectedSensitivities: (value) => setFormState(prev => ({ ...prev, selectedSensitivities: value })),
        setSelectedStores: (value) => setFormState(prev => ({ ...prev, selectedStores: value })),
        setSelectedFoodGroups: (value) => setFormState(prev => ({ ...prev, selectedFoodGroups: value })),
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const { formData, selectedVitamins, selectedMinerals, selectedSensitivities, selectedStores, selectedFoodGroups } = formState;

        try {
            const currentUserId = userId || authUser.id;
            if (!currentUserId) throw new Error("No se pudo identificar al usuario.");

            const requestData = {
                user_id: currentUserId,
                name: formData.name,
                food_unit: formData.food_unit,
                proteins: formData.proteins || null,
                total_carbs: formData.total_carbs || null,
                total_fats: formData.total_fats || null,
                status: 'pending',
            };

            const { data: savedRequest, error: requestError } = await supabase
                .from('food')
                .insert(requestData)
                .select()
                .single();

            if (requestError) throw requestError;
            const newFoodId = savedRequest.id;

            // Handle sensitivities
            if (selectedSensitivities.length > 0) {
                const sensitivitiesToSave = selectedSensitivities.map(id => ({ food_id: newFoodId, sensitivity_id: id }));
                const { error: sensError } = await supabase.from('food_sensitivities').insert(sensitivitiesToSave);
                if (sensError) throw sensError;
            }

            // Handle vitamins
            const vitaminsToSave = selectedVitamins
                .filter(v => v.vitamin_id && parseFloat(v.mg_per_100g) > 0)
                .map(v => ({ food_id: newFoodId, vitamin_id: v.vitamin_id, mg_per_100g: v.mg_per_100g }));
            if (vitaminsToSave.length > 0) {
                const { error: vitError } = await supabase.from('food_vitamins').insert(vitaminsToSave);
                if (vitError) throw vitError;
            }

            // Handle minerals
            const mineralsToSave = selectedMinerals
                .filter(m => m.mineral_id && parseFloat(m.mg_per_100g) > 0)
                .map(m => ({ food_id: newFoodId, mineral_id: m.mineral_id, mg_per_100g: m.mg_per_100g }));
            if (mineralsToSave.length > 0) {
                const { error: minError } = await supabase.from('food_minerals').insert(mineralsToSave);
                if (minError) throw minError;
            }

            // Handle stores
            if (selectedStores.length > 0) {
                const storesToSave = selectedStores.map(id => ({ food_id: newFoodId, store_id: id }));
                const { error } = await supabase.from('food_to_stores').insert(storesToSave);
                if (error) throw error;
            }
            
            // Handle food groups
            if (selectedFoodGroups.length > 0) {
                const groupsToSave = selectedFoodGroups.map(id => ({ food_id: newFoodId, food_group_id: id }));
                const { error } = await supabase.from('food_to_food_groups').insert(groupsToSave);
                if (error) throw error;
            }

            toast({ title: 'Éxito', description: 'Solicitud de alimento enviada correctamente.' });
            if (onFoodActionComplete) onFoodActionComplete(savedRequest);
        } catch (error) {
            console.error('Error submitting simplified food form:', error);
            toast({ title: 'Error', description: `No se pudo enviar la solicitud. ${error.message}`, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        state,
        formState,
        formHandlers,
        isSubmitting,
        isLoading: state.isLoading,
        handleSubmit,
        isMineralsOpen,
        setIsMineralsOpen,
    };
};
