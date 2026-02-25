import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Utensils, Shield, HeartPulse, X, PlusCircle, Info, Sun, Apple, CheckCircle2 } from 'lucide-react';
import ProfileSectionCard from '@/components/profile/ProfileSectionCard.jsx';
import FormRow from '@/components/profile/FormRow.jsx';
import DayMealsPreferencesForm from '@/components/profile/DayMealsPreferencesForm.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import FoodPreferenceSelector from '@/components/profile/FoodPreferenceSelector';
import { Badge } from '@/components/ui/badge';
import FormBlock from '@/components/profile/FormBlock';
import SearchSelectionModal from '@/components/shared/SearchSelectionModal';
import { debounce } from 'lodash';

const DietPreferencesForm = ({ userId: propUserId, onUpdate }) => {
  const { user: authUser } = useAuth();
  const userId = propUserId || authUser?.id;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
  const [formData, setFormData] = useState({
    diet_goal_id: null,
    diet_history: '',
    diet_type_id: null,
    lives_alone: false,
    eats_out: false,
    likes_cooking: false,
  });
  
  const [allSensitivities, setAllSensitivities] = useState([]);
  const [allMedicalConditions, setAllMedicalConditions] = useState([]);
  const [selectedSensitivities, setSelectedSensitivities] = useState([]);
  const [selectedMedicalConditions, setSelectedMedicalConditions] = useState([]);
  
  const [allergicFoodIds, setAllergicFoodIds] = useState([]);
  const [restrictedByConditionFoodIds, setRestrictedByConditionFoodIds] = useState([]);

  const [dietTypes, setDietTypes] = useState([]);
  const [dietGoals, setDietGoals] = useState([]);
  const [foods, setFoods] = useState([]);
  const [preferredFoods, setPreferredFoods] = useState([]);
  const [nonPreferredFoods, setNonPreferredFoods] = useState([]);

  // Modals State
  const [isSensitivityModalOpen, setIsSensitivityModalOpen] = useState(false);
  const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
  const [sensitivityLevel, setSensitivityLevel] = useState('Leve');

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [
        prefsData,
        sensitivitiesRes, userSensitivitiesRes,
        medicalConditionsRes, userMedicalConditionsRes,
        dietTypesRes, dietGoalsRes, foodsRes,
        preferredFoodsRes, nonPreferredFoodsRes
      ] = await Promise.all([
        supabase.from('diet_preferences').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('sensitivities').select('id, name'),
        supabase.from('user_sensitivities').select('sensitivity_id, sensitivitie_level').eq('user_id', userId),
        supabase.from('medical_conditions').select('id, name'),
        supabase.from('user_medical_conditions').select('condition_id').eq('user_id', userId),
        supabase.from('diet_types').select('id, name'),
        supabase.from('diet_goals').select('id, name, description').order('name'),
        supabase.from('food').select('id, name').order('name'),
        supabase.from('preferred_foods').select('food_id, food(id, name)').eq('user_id', userId),
        supabase.from('non_preferred_foods').select('food_id, food(id, name)').eq('user_id', userId),
      ]);

      if (prefsData.error && prefsData.error.code !== 'PGRST116') throw prefsData.error;
      if (sensitivitiesRes.error) throw sensitivitiesRes.error;
      if (userSensitivitiesRes.error) throw userSensitivitiesRes.error;
      if (medicalConditionsRes.error) throw medicalConditionsRes.error;
      if (userMedicalConditionsRes.error) throw userMedicalConditionsRes.error;
      if (dietTypesRes.error) throw dietTypesRes.error;
      if (dietGoalsRes.error) throw dietGoalsRes.error;
      if (foodsRes.error) throw foodsRes.error;
      if (preferredFoodsRes.error) throw preferredFoodsRes.error;
      if (nonPreferredFoodsRes.error) throw nonPreferredFoodsRes.error;

      if (prefsData.data) {
        const { diet_types, ...restData } = prefsData.data;
        setFormData(prev => ({ ...prev, ...restData }));
      }
      setAllSensitivities(sensitivitiesRes.data || []);
      setSelectedSensitivities(userSensitivitiesRes.data || []);
      setAllMedicalConditions(medicalConditionsRes.data || []);
      setSelectedMedicalConditions((userMedicalConditionsRes.data || []).map(c => c.condition_id));
      setDietTypes(dietTypesRes.data || []);
      setDietGoals(dietGoalsRes.data || []);
      setFoods(foodsRes.data || []);
      setPreferredFoods((preferredFoodsRes.data || []).map(pf => pf.food).filter(Boolean));
      setNonPreferredFoods((nonPreferredFoodsRes.data || []).map(npf => npf.food).filter(Boolean));

    } catch (error) {
      console.error("Error fetching diet preferences:", error);
      toast({ title: 'Error', description: 'No se pudieron cargar las preferencias de dieta.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const fetchRestrictedFoods = async () => {
      const sensitivityIds = selectedSensitivities.map(s => s.sensitivity_id);
      const conditionIds = selectedMedicalConditions;

      let allergicIds = [];
      if (sensitivityIds.length > 0) {
        const { data, error } = await supabase.from('food_sensitivities').select('food_id').in('sensitivity_id', sensitivityIds);
        if (!error) allergicIds = data.map(item => item.food_id);
      }
      setAllergicFoodIds(allergicIds);

      let conditionIdsRestricted = [];
      if (conditionIds.length > 0) {
        const { data, error } = await supabase.from('food_medical_conditions').select('food_id').in('condition_id', conditionIds);
        if (!error) conditionIdsRestricted = data.map(item => item.food_id);
      }
      setRestrictedByConditionFoodIds(conditionIdsRestricted);
    };
    fetchRestrictedFoods();
  }, [selectedSensitivities, selectedMedicalConditions]);

  // Auto-save logic for form data
  const performSave = async (dataToSave) => {
    setSaveStatus('saving');
    try {
        const { error } = await supabase
            .from('diet_preferences')
            .upsert({ ...dataToSave, user_id: userId }, { onConflict: 'user_id' });
        
        if (error) throw error;
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
        console.error("Error saving preferences:", error);
        setSaveStatus('error');
        toast({ title: 'Error', description: 'No se pudieron guardar los cambios.', variant: 'destructive' });
    }
  };

  const debouncedSave = useCallback(
    debounce((data) => performSave(data), 1500),
    [userId]
  );

  const updateFormData = (updates) => {
      setFormData(prev => {
          const newState = { ...prev, ...updates };
          debouncedSave(newState);
          return newState;
      });
  };

  const handleChange = (id, value) => updateFormData({ [id]: value });

  const handleAddSensitivity = async (sensitivity) => {
    if (selectedSensitivities.some(s => s.sensitivity_id === sensitivity.id)) {
        toast({ title: "Info", description: "Esta sensibilidad ya está añadida.", variant: "default" });
        return;
    }
    const { error } = await supabase.from('user_sensitivities').insert({ user_id: userId, sensitivity_id: sensitivity.id, sensitivitie_level: sensitivityLevel });
    if (error) {
        toast({ title: "Error", description: "No se pudo añadir la sensibilidad.", variant: "destructive" });
    } else {
        setSelectedSensitivities(prev => [...prev, { sensitivity_id: sensitivity.id, sensitivitie_level: sensitivityLevel }]);
        toast({ title: "Éxito", description: "Sensibilidad añadida." });
        setIsSensitivityModalOpen(false);
    }
  };

  const handleRemoveSensitivity = async (sensitivityId) => {
    const { error } = await supabase.from('user_sensitivities').delete().eq('user_id', userId).eq('sensitivity_id', sensitivityId);
    if (error) {
        toast({ title: "Error", description: "No se pudo quitar la sensibilidad.", variant: "destructive" });
    } else {
        setSelectedSensitivities(prev => prev.filter(s => s.sensitivity_id !== sensitivityId));
        toast({ title: "Éxito", description: "Sensibilidad eliminada." });
    }
  };

  const handleAddCondition = async (condition) => {
    if (selectedMedicalConditions.includes(condition.id)) {
         toast({ title: "Info", description: "Esta condición ya está añadida.", variant: "default" });
         return;
    }
    const { error } = await supabase.from('user_medical_conditions').insert({ user_id: userId, condition_id: condition.id });
    if (error) {
        toast({ title: "Error", description: "No se pudo añadir la condición médica.", variant: "destructive" });
    } else {
        setSelectedMedicalConditions(prev => [...prev, condition.id]);
        toast({ title: "Éxito", description: "Condición médica añadida." });
        setIsConditionModalOpen(false);
    }
  };

  const handleRemoveCondition = async (conditionId) => {
    const { error } = await supabase.from('user_medical_conditions').delete().eq('user_id', userId).eq('condition_id', conditionId);
    if (error) {
        toast({ title: "Error", description: "No se pudo quitar la condición médica.", variant: "destructive" });
    } else {
        setSelectedMedicalConditions(prev => prev.filter(c => c !== conditionId));
        toast({ title: "Éxito", description: "Condición médica eliminada." });
    }
  };
  
  const availableSensitivities = useMemo(() => {
     return allSensitivities.filter(s => !selectedSensitivities.some(sel => sel.sensitivity_id === s.id));
  }, [allSensitivities, selectedSensitivities]);

  const availableConditions = useMemo(() => {
     return allMedicalConditions.filter(c => !selectedMedicalConditions.includes(c.id));
  }, [allMedicalConditions, selectedMedicalConditions]);

  const foodOptions = useMemo(() => foods
    .filter(food => 
      !preferredFoods.some(pf => pf.id === food.id) && 
      !nonPreferredFoods.some(npf => npf.id === food.id) &&
      !allergicFoodIds.includes(food.id) &&
      !restrictedByConditionFoodIds.includes(food.id)
    )
    .map(food => ({ value: String(food.id), label: food.name })), 
  [foods, preferredFoods, nonPreferredFoods, allergicFoodIds, restrictedByConditionFoodIds]);

  const selectedGoalDescription = useMemo(() => {
      const goal = dietGoals.find(g => g.id === formData.diet_goal_id);
      return goal ? goal.description : '';
  }, [formData.diet_goal_id, dietGoals]);

  if (loading) return <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>;
  
  return (
    <ProfileSectionCard 
      title="Preferencias de Dieta" 
      icon={Utensils} 
      color="green"
      headerAction={
        <div className="flex items-center gap-2">
            {saveStatus === 'saving' && <span className="text-xs text-green-400 flex items-center bg-green-900/30 px-2 py-1 rounded-full animate-pulse"><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Guardando...</span>}
            {saveStatus === 'saved' && <span className="text-xs text-green-400 flex items-center bg-green-900/30 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3 mr-1.5" /> Guardado</span>}
        </div>
      }
    >
      <div className="space-y-8">
        
        <FormBlock title="Información General" icon={Info} color="green">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="flex flex-col space-y-2">
                    <Label htmlFor="diet_goal_id" className="text-gray-300">Objetivo de Dieta</Label>
                    <Select 
                        value={formData.diet_goal_id || ''} 
                        onValueChange={(v) => handleChange('diet_goal_id', v)}
                    >
                        <SelectTrigger id="diet_goal_id" className="w-full bg-gray-800/50 border-gray-700 text-white">
                            <SelectValue placeholder="Selecciona un objetivo..." />
                        </SelectTrigger>
                        <SelectContent className="z-[200]">
                            {dietGoals.map((g) => (
                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedGoalDescription && (
                        <p className="text-xs text-green-400 mt-2">{selectedGoalDescription}</p>
                    )}
                </div>
                <div className="flex flex-col space-y-2">
                    <Label htmlFor="diet_type_id" className="text-gray-300">Tipo de Dieta</Label>
                    <Select value={formData.diet_type_id ? String(formData.diet_type_id) : ''} onValueChange={(v) => handleChange('diet_type_id', v ? parseInt(v, 10) : null)}>
                        <SelectTrigger id="diet_type_id" className="w-full bg-gray-800/50 border-gray-700 text-white"><SelectValue placeholder="Selecciona un tipo..." /></SelectTrigger>
                        <SelectContent className="z-[200]">{(dietTypes || []).map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            <FormRow id="diet_history" label="Historial de Dieta" type="textarea" value={formData.diet_history || ''} onChange={handleChange} placeholder="Cuéntame sobre tus dietas anteriores..." />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <FormRow id="lives_alone" label="Vivo solo/a" type="checkbox" value={formData.lives_alone} onChange={handleChange} color="green"/>
                <FormRow id="eats_out" label="Suelo comer fuera" type="checkbox" value={formData.eats_out} onChange={handleChange} color="green"/>
                <FormRow id="likes_cooking" label="Me gusta cocinar" type="checkbox" value={formData.likes_cooking} onChange={handleChange} color="green"/>
            </div>
        </FormBlock>

        <FormBlock title="Comidas del Día" icon={Sun} color="yellow">
            <DayMealsPreferencesForm userId={userId} />
        </FormBlock>

        <FormBlock title="Restricciones Alimentarias" icon={Shield} color="orange-red">
            <div className="space-y-6">
            <div className="p-4 rounded-lg border border-orange-500/30 bg-[#47330526]">
                    <div className="flex items-center justify-between mb-4">
                         <h4 className="font-semibold text-orange-400 flex items-center gap-2"><Shield size={16}/> Sensibilidades</h4>
                         <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            className="border-orange-500/50 text-orange-400 bg-[hsl(36deg_63.96%_15.46%_/_0.65)] hover:bg-[hsl(36deg_63.96%_15.46%_/_0.58)] hover:text-gray-100" 
                            onClick={() => setIsSensitivityModalOpen(true)}
                         >
                            <PlusCircle className="w-4 h-4 mr-2" /> Añadir
                         </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-3">
                      {selectedSensitivities.length === 0 && <p className="text-gray-500 text-sm italic">No hay sensibilidades seleccionadas.</p>}
                      {selectedSensitivities.map(s => {
                        const details = allSensitivities.find(as => as.id === s.sensitivity_id);
                        return details ? (
                            <Badge key={s.sensitivity_id} variant="destructive" className="bg-orange-600/20 border border-orange-500/30 text-orange-300">
                                {details.name} ({s.sensitivitie_level})
                                <button type="button" onClick={() => handleRemoveSensitivity(s.sensitivity_id)} className="ml-2 hover:text-white"><X size={14}/></button>
                            </Badge>
                        ) : null;
                      })}
                    </div>
                </div>

                <div className="p-4 rounded-lg border border-red-500/30 bg-[#47050526]">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-red-400 flex items-center gap-2"><HeartPulse size={16}/> Condiciones Médicas</h4>
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            className="border-red-500/50 text-red-400 bg-[hsl(0deg_60%_11.41%_/_0.65)] hover:bg-[hsl(0deg_60%_11.41%_/_0.58)] hover:text-gray-100" 
                            onClick={() => setIsConditionModalOpen(true)}
                        >
                             <PlusCircle className="w-4 h-4 mr-2" /> Añadir
                        </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-3">
                      {selectedMedicalConditions.length === 0 && <p className="text-gray-500 text-sm italic">No hay condiciones seleccionadas.</p>}
                      {selectedMedicalConditions.map(cId => {
                        const details = allMedicalConditions.find(amc => amc.id === cId);
                        return details ? <Badge key={cId} variant="destructive" className="bg-red-600/20 border border-red-500/30 text-red-300">{details.name} <button type="button" onClick={() => handleRemoveCondition(cId)} className="ml-2 hover:text-white"><X size={14}/></button></Badge> : null;
                      })}
                    </div>
                </div>
            </div>
        </FormBlock>

        <FormBlock title="Gustos por Alimentos" icon={Apple} color="green-red">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FoodPreferenceSelector userId={userId} foodOptions={foodOptions} selectedFoods={preferredFoods} setSelectedFoods={setPreferredFoods} allFoods={foods} type="preferred" />
                <FoodPreferenceSelector userId={userId} foodOptions={foodOptions} selectedFoods={nonPreferredFoods} setSelectedFoods={setNonPreferredFoods} allFoods={foods} type="non-preferred" />
            </div>
        </FormBlock>
      </div>
      
      {/* Modals */}
      <SearchSelectionModal 
        open={isSensitivityModalOpen} 
        onOpenChange={setIsSensitivityModalOpen}
        title="Añadir Sensibilidad"
        searchPlaceholder="Buscar sensibilidad..."
        items={availableSensitivities}
        onSelect={handleAddSensitivity}
        headerContent={
            <div className="flex items-center gap-3 p-2 rounded bg-gray-800/50 border border-gray-700">
                <span className="text-sm text-gray-400 whitespace-nowrap">Nivel de sensibilidad:</span>
                <Select value={sensitivityLevel} onValueChange={setSensitivityLevel}>
                    <SelectTrigger className="h-8 w-32 bg-gray-700 border-gray-600 text-xs text-white">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                        <SelectItem value="Leve">Leve</SelectItem>
                        <SelectItem value="Moderado">Moderado</SelectItem>
                        <SelectItem value="Grave">Grave</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        }
      />

      <SearchSelectionModal 
        open={isConditionModalOpen} 
        onOpenChange={setIsConditionModalOpen}
        title="Añadir Condición Médica"
        searchPlaceholder="Buscar condición..."
        items={availableConditions}
        onSelect={handleAddCondition}
      />

    </ProfileSectionCard>
  );
};

export default DietPreferencesForm;