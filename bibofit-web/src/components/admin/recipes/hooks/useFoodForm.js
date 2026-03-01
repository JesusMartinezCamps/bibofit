import { useState, useEffect, useCallback, useMemo } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { saveFoodData, loadFoodForEditing } from './foodFormUtils';

    const initialFormState = {
      formData: {
        name: '',
        food_unit: 'gramos',
        food_url: '',
        proteins: '',
        protein_source_id: '',
        total_carbs: '',
        total_fats: '',
        salt: '',
      },
      manualFatClassificationBreakdown: {},
      fatClassificationBreakdown: {},
      fatTypeBreakdown: {},
      manualCarbTypeBreakdown: {},
      manualCarbClassificationBreakdown: {},
      carbTypeBreakdown: {},
      carbClassificationBreakdown: {},
      carbSubtypeBreakdown: {},
      aminoAcidBreakdown: {},
      selectedVitamins: [],
      selectedMinerals: [],
      selectedSensitivities: [],
      selectedAntioxidants: [],
      selectedMedicalConditions: [],
      selectedFoodGroups: [],
      selectedMacroRoles: [],
      selectedSeasons: [],
      selectedStores: [],
      selectedDominantAminos: [],
      selectedLimitingAminos: [],
    };

    const formatNumberForDB = (num) => {
        const number = parseFloat(num);
        if (isNaN(number)) return "0";
        const fixedNum = number.toFixed(2);
        return fixedNum.endsWith('.00') ? String(parseInt(number, 10)) : Number(fixedNum).toString();
    };

    export const useFoodForm = ({ foodToEdit, onFoodActionComplete, isEditing, isClientRequest }) => {
      const { toast } = useToast();
      
      const [state, setState] = useState({
        allFoodGroups: [],
        allMacroRoles: [],
        allSeasons: [],
        allStores: [],
        allProteinSources: [],
        allAminograms: [],
        allFatTypes: [],
        allFatClassifications: [],
        allCarbClassifications: [],
        allCarbTypes: [],
        allCarbSubtypes: [],
        allVitamins: [],
        allMinerals: [],
        allSensitivities: [],
        allAntioxidants: [],
        allMedicalConditions: [],
        isLoading: true,
      });

      const [formState, setFormState] = useState(initialFormState);
      const [isSubmitting, setIsSubmitting] = useState(false);

      const fetchInitialData = useCallback(async () => {
        setState(prevState => ({ ...prevState, isLoading: true }));
        try {
          const [
            foodGroupsRes, macroRolesRes, seasonsRes, storesRes, proteinSourcesRes, aminogramsRes,
            fatTypesRes, fatClassificationsRes, carbClassificationsRes, carbTypesRes, carbSubtypesRes,
            vitaminsRes, mineralsRes, sensitivitiesRes, antioxidantsRes, medicalConditionsRes
          ] = await Promise.all([
            supabase.from('food_groups').select('*, protein_sources(id, name)'),
            supabase.from('macro_roles').select('*'),
            supabase.from('seasons').select('*'),
            supabase.from('stores').select('*'),
            supabase.from('protein_sources').select('*'),
            supabase.from('aminograms').select('*'),
            supabase.from('fat_types').select('*'),
            supabase.from('fat_classification').select('*'),
            supabase.from('carb_classification').select('*'),
            supabase.from('carb_types').select('*'),
            supabase.from('carb_subtypes').select('*'),
            supabase.from('vitamins').select('*'),
            supabase.from('minerals').select('*'),
            supabase.from('sensitivities').select('*'),
            supabase.from('antioxidants').select('*'),
            supabase.from('medical_conditions').select('*'),
          ]);

          const checkError = (res, name) => {
            if (res.error) throw new Error(`Error fetching ${name}: ${res.error.message}`);
            return res.data;
          };
          
          setState({
            allFoodGroups: checkError(foodGroupsRes, 'food groups'),
            allMacroRoles: checkError(macroRolesRes, 'macro roles'),
            allSeasons: checkError(seasonsRes, 'seasons'),
            allStores: checkError(storesRes, 'stores'),
            allProteinSources: checkError(proteinSourcesRes, 'protein sources'),
            allAminograms: checkError(aminogramsRes, 'aminograms'),
            allFatTypes: checkError(fatTypesRes, 'fat types'),
            allFatClassifications: checkError(fatClassificationsRes, 'fat classifications'),
            allCarbClassifications: checkError(carbClassificationsRes, 'carb classifications'),
            allCarbTypes: checkError(carbTypesRes, 'carb types'),
            allCarbSubtypes: checkError(carbSubtypesRes, 'carb subtypes'),
            allVitamins: checkError(vitaminsRes, 'vitamins'),
            allMinerals: checkError(mineralsRes, 'minerals'),
            allSensitivities: checkError(sensitivitiesRes, 'sensitivities'),
            allAntioxidants: checkError(antioxidantsRes, 'antioxidants'),
            allMedicalConditions: checkError(medicalConditionsRes, 'medical conditions'),
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

      const resetForm = useCallback(() => {
        setFormState(initialFormState);
      }, []);

      const populateFormForEditing = useCallback(async (food) => {
          if (!food) return;
          
          setState(prevState => ({ ...prevState, isLoading: true }));
          try {
              await loadFoodForEditing(food.id, setFormState, toast, isClientRequest);
          } catch (error) {
              console.error("Error populating form for editing:", error);
          } finally {
              setState(prevState => ({ ...prevState, isLoading: false }));
          }
      }, [toast, isClientRequest]);

      useEffect(() => {
        if (isEditing && foodToEdit) {
          populateFormForEditing(foodToEdit);
        } else {
          resetForm();
        }
      }, [isEditing, foodToEdit, populateFormForEditing, resetForm]);

      const {
        fatTypeBreakdown,
        selectedFoodGroups
      } = formState;

      const handleChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, formData: { ...prev.formData, [name]: value } }));
      };

      const handleSelectChange = (name, value) => {
        setFormState(prev => ({ ...prev, formData: { ...prev.formData, [name]: value } }));
      };

      const handleManualBreakdownChange = (level, id, value) => {
        let fieldName;
        if (level === 'total_carbs' || level === 'total_fats') {
            setFormState(prev => ({ ...prev, formData: { ...prev.formData, [level]: value } }));
            return;
        } else if (level === 'carbType') {
            fieldName = 'manualCarbTypeBreakdown';
        } else if (level === 'carbClassification') {
            fieldName = 'manualCarbClassificationBreakdown';
        } else if (level === 'fatClassification') {
            fieldName = 'manualFatClassificationBreakdown';
        } else {
            return;
        }
        
        setFormState(prev => ({
            ...prev,
            [fieldName]: {
                ...prev[fieldName],
                [id]: value
            }
        }));
      };

      const handleFatTypeChange = (fatTypeId, value) => {
        setFormState(prev => ({
            ...prev,
            fatTypeBreakdown: {
                ...prev.fatTypeBreakdown,
                [fatTypeId]: value
            }
        }));
      };

      const handleCarbSubtypeChange = (classificationId, subtypeId, value) => {
        setFormState(prev => ({
          ...prev,
          carbSubtypeBreakdown: {
            ...prev.carbSubtypeBreakdown,
            [classificationId]: {
              ...prev.carbSubtypeBreakdown[classificationId],
              [subtypeId]: value
            }
          }
        }));
      };

      const handleSeasonChange = (values) => {
        const allYearId = state.allSeasons.find(s => s.name === 'Todo el año')?.id;
        if (values.includes(allYearId)) {
            setFormState(prev => ({...prev, selectedSeasons: [allYearId]}));
        } else {
            setFormState(prev => ({...prev, selectedSeasons: values}));
        }
      };

      useEffect(() => {
        if (selectedFoodGroups.length > 0 && state.allFoodGroups.length > 0) {
          const selectedGroupsData = state.allFoodGroups.filter(fg => selectedFoodGroups.includes(fg.id));
          const proteinSourceIds = new Set(selectedGroupsData.map(fg => fg.protein_source_id).filter(Boolean));

          if (proteinSourceIds.size === 1) {
            const singleSourceId = proteinSourceIds.values().next().value;
            if (String(formState.formData.protein_source_id) !== String(singleSourceId)) {
              setFormState(prev => ({
                ...prev,
                formData: { ...prev.formData, protein_source_id: String(singleSourceId) }
              }));
            }
          }
        }
      }, [selectedFoodGroups, state.allFoodGroups, formState.formData.protein_source_id]);
      
      const fatClassificationBreakdown = useMemo(() => {
        return state.allFatClassifications.reduce((acc, classification) => {
            const typesInClassification = state.allFatTypes.filter(type => type.fat_classification_id === classification.id);
            acc[classification.id] = typesInClassification.reduce((sum, type) => sum + (parseFloat(fatTypeBreakdown[type.id]) || 0), 0);
            return acc;
        }, {});
      }, [fatTypeBreakdown, state.allFatClassifications, state.allFatTypes]);

      const handleTotalFatsSync = useCallback(() => {
        const calculatedValue = Object.values(fatClassificationBreakdown).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
        setFormState(prev => ({
          ...prev,
          formData: { ...prev.formData, total_fats: formatNumberForDB(calculatedValue) },
        }));
      }, [fatClassificationBreakdown]);

      const handleFatClassificationSync = useCallback((classificationId) => {
        const calculatedValue = fatClassificationBreakdown[classificationId] || 0;
        setFormState(prev => ({
            ...prev,
            manualFatClassificationBreakdown: {
                ...prev.manualFatClassificationBreakdown,
                [classificationId]: formatNumberForDB(calculatedValue),
            },
        }));
      }, [fatClassificationBreakdown]);

      const handleTotalCarbsSync = useCallback((calculatedTotal, calculatedTypes, calculatedClassifications) => {
        setFormState(prev => {
          const newManualCarbTypeBreakdown = { ...prev.manualCarbTypeBreakdown };
          Object.keys(calculatedTypes).forEach(typeId => {
            const calculatedValue = parseFloat(calculatedTypes[typeId]);
            if (calculatedValue > 0) {
              newManualCarbTypeBreakdown[typeId] = formatNumberForDB(calculatedValue);
            }
          });
      
          const newManualCarbClassificationBreakdown = { ...prev.manualCarbClassificationBreakdown };
          Object.keys(calculatedClassifications).forEach(classId => {
            const calculatedValue = parseFloat(calculatedClassifications[classId]);
            if (calculatedValue > 0) {
              newManualCarbClassificationBreakdown[classId] = formatNumberForDB(calculatedValue);
            }
          });
      
          return {
            ...prev,
            formData: { ...prev.formData, total_carbs: formatNumberForDB(calculatedTotal || 0) },
            manualCarbTypeBreakdown: newManualCarbTypeBreakdown,
            manualCarbClassificationBreakdown: newManualCarbClassificationBreakdown,
          };
        });
      }, []);
      
      const handleCarbTypeSync = useCallback((typeId, calculatedTypeValue, calculatedClassifications) => {
        setFormState(prev => {
          const newManualCarbClassificationBreakdown = { ...prev.manualCarbClassificationBreakdown };
          const classificationsForType = state.allCarbClassifications.filter(c => c.carb_type_id === typeId);
          
          classificationsForType.forEach(classification => {
            const classId = classification.id;
            const calculatedValue = parseFloat(calculatedClassifications[classId]);
            if (calculatedValue > 0) {
              newManualCarbClassificationBreakdown[classId] = formatNumberForDB(calculatedValue);
            }
          });
      
          const newManualCarbTypeBreakdown = { ...prev.manualCarbTypeBreakdown };
          const finalTypeValue = parseFloat(calculatedTypeValue);
          if (finalTypeValue > 0) {
            newManualCarbTypeBreakdown[typeId] = formatNumberForDB(finalTypeValue);
          }

          return {
            ...prev,
            manualCarbTypeBreakdown: newManualCarbTypeBreakdown,
            manualCarbClassificationBreakdown: newManualCarbClassificationBreakdown,
          };
        });
      }, [state.allCarbClassifications]);
      
      const handleCarbClassificationSync = useCallback((classificationId, calculatedValue) => {
        setFormState(prev => ({
          ...prev,
          manualCarbClassificationBreakdown: {
            ...prev.manualCarbClassificationBreakdown,
            [classificationId]: formatNumberForDB(calculatedValue || 0),
          },
        }));
      }, []);

      const setSelectedDominantAminos = (newSelection) => {
        setFormState(prev => ({
          ...prev,
          selectedDominantAminos: newSelection,
          selectedLimitingAminos: prev.selectedLimitingAminos.filter(id => !newSelection.includes(id)),
        }));
      };

      const setSelectedLimitingAminos = (newSelection) => {
        setFormState(prev => ({
          ...prev,
          selectedLimitingAminos: newSelection,
          selectedDominantAminos: prev.selectedDominantAminos.filter(id => !newSelection.includes(id)),
        }));
      };

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
        handleManualBreakdownChange,
        handleFatTypeChange,
        handleCarbSubtypeChange,
        handleSeasonChange,
        handleTotalFatsSync,
        handleFatClassificationSync,
        handleTotalCarbsSync,
        handleCarbTypeSync,
        handleCarbClassificationSync,
        setAminoAcidBreakdown: (value) => setFormState(prev => ({ ...prev, aminoAcidBreakdown: value })),
        setSelectedVitamins: (value) => setFormState(prev => ({ ...prev, selectedVitamins: value })),
        setSelectedMinerals: handleMineralsChange,
        setSelectedSensitivities: (value) => setFormState(prev => ({ ...prev, selectedSensitivities: value })),
        setSelectedAntioxidants: (value) => setFormState(prev => ({ ...prev, selectedAntioxidants: value })),
        setSelectedMedicalConditions: (value) => setFormState(prev => ({ ...prev, selectedMedicalConditions: value })),
        setSelectedFoodGroups: (value) => setFormState(prev => ({ ...prev, selectedFoodGroups: value })),
        setSelectedMacroRoles: (value) => setFormState(prev => ({ ...prev, selectedMacroRoles: value })),
        setSelectedStores: (value) => setFormState(prev => ({ ...prev, selectedStores: value })),
        setSelectedDominantAminos,
        setSelectedLimitingAminos,
      };

      const groupedCarbSubtypes = useMemo(() => {
        if (!state.allCarbSubtypes) return {};
        return state.allCarbSubtypes.reduce((acc, subtype) => {
            const key = subtype.classification_id;
            if (!acc[key]) acc[key] = [];
            acc[key].push(subtype);
            return acc;
        }, {});
      }, [state.allCarbSubtypes]);

      const groupedFatTypes = useMemo(() => {
        if (!state.allFatTypes) return {};
        return state.allFatTypes.reduce((acc, type) => {
            const key = type.fat_classification_id;
            if (!acc[key]) acc[key] = [];
            acc[key].push(type);
            return acc;
        }, {});
      }, [state.allFatTypes]);

      const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
          const finalFormState = {
            ...formState,
            fatClassificationBreakdown,
          };
          const newFoodId = await saveFoodData(isEditing, foodToEdit?.id, finalFormState, state.allCarbTypes, isClientRequest);
          
          const tableName = 'food';
          const { data: newFood } = await supabase.from(tableName).select('*').eq('id', newFoodId).single();
          
          toast({ title: 'Éxito', description: `Alimento ${isEditing ? 'actualizado' : 'creado'} correctamente.` });
          if (onFoodActionComplete) onFoodActionComplete(newFood);
        } catch (error) {
          console.error('Error submitting food form:', error);
          toast({ title: 'Error', description: `No se pudo procesar la solicitud. ${error.message}`, variant: 'destructive' });
        } finally {
          setIsSubmitting(false);
        }
      };

      return {
        state,
        formState: { ...formState, fatClassificationBreakdown },
        formHandlers,
        isSubmitting,
        isLoading: state.isLoading,
        handleSubmit,
        groupedCarbSubtypes,
        groupedFatTypes,
      };
    };
