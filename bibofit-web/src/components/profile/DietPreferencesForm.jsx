import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Utensils, Shield, Info, Sun, Apple, CheckCircle2 } from 'lucide-react';
import ProfileSectionCard from '@/components/profile/ProfileSectionCard.jsx';
import FormRow from '@/components/profile/FormRow.jsx';
import DayMealsPreferencesForm from '@/components/profile/DayMealsPreferencesForm.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import FormBlock from '@/components/profile/FormBlock';
import DietTypeSelector from '@/components/shared/DietTypeSelector';
import FoodRestrictionsForm from '@/components/profile/FoodRestrictionsForm';
import FoodPreferencesForm from '@/components/profile/FoodPreferencesForm';
import { debounce } from 'lodash';

const DietPreferencesForm = ({ userId: propUserId, onUpdate: _onUpdate }) => {
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
  
  const [selectedSensitivityIds, setSelectedSensitivityIds] = useState(null);
  const [selectedMedicalConditionIds, setSelectedMedicalConditionIds] = useState(null);
  
  const [allergicFoodIds, setAllergicFoodIds] = useState([]);

  const [dietTypes, setDietTypes] = useState([]);
  const [dietGoals, setDietGoals] = useState([]);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [
        prefsData,
        dietTypesRes,
        dietGoalsRes
      ] = await Promise.all([
        supabase.from('diet_preferences').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('diet_types').select('id, name, description, diet_type_food_group_rules(rule_type, food_groups(name))').order('name'),
        supabase.from('diet_goals').select('id, name, description').order('name'),
      ]);

      if (prefsData.error && prefsData.error.code !== 'PGRST116') throw prefsData.error;
      if (dietTypesRes.error) throw dietTypesRes.error;
      if (dietGoalsRes.error) throw dietGoalsRes.error;

      if (prefsData.data) {
        const { diet_types, ...restData } = prefsData.data;
        setFormData(prev => ({ ...prev, ...restData }));
      }
      setDietTypes(dietTypesRes.data || []);
      setDietGoals(dietGoalsRes.data || []);

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
      const sensitivityIds = selectedSensitivityIds || [];
      let allergicIds = [];
      if (sensitivityIds.length > 0) {
        const { data, error } = await supabase.from('food_sensitivities').select('food_id').in('sensitivity_id', sensitivityIds);
        if (!error) allergicIds = data.map(item => item.food_id);
      }
      setAllergicFoodIds(allergicIds);
    };
    fetchRestrictedFoods();
  }, [selectedSensitivityIds]);

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

  const handleRestrictionsChange = useCallback(({ sensitivityIds, medicalConditionIds }) => {
    setSelectedSensitivityIds(Array.isArray(sensitivityIds) ? sensitivityIds : []);
    setSelectedMedicalConditionIds(Array.isArray(medicalConditionIds) ? medicalConditionIds : []);
  }, []);

  // userRestrictions para FoodPreferenceSelector: sensibilidades, condiciones y tipo de dieta.
  // Sin preferred/non_preferred_foods (eso lo gestiona el propio selector).
  const userRestrictionsForFoodSelector = useMemo(() => {
    const selectedDietType = formData.diet_type_id
      ? dietTypes.find(dt => String(dt.id) === String(formData.diet_type_id))
      : null;
    const sensitivityIds = selectedSensitivityIds || [];
    const medicalConditionIds = selectedMedicalConditionIds || [];
    return {
      sensitivities: sensitivityIds.map((id) => ({ id })),
      medical_conditions: medicalConditionIds.map((id) => ({ id })),
      diet_type_id: formData.diet_type_id || null,
      diet_type_name: selectedDietType?.name || null,
      diet_type_rules: selectedDietType?.diet_type_food_group_rules || [],
    };
  }, [selectedSensitivityIds, selectedMedicalConditionIds, formData.diet_type_id, dietTypes]);

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
                    <Label htmlFor="diet_goal_id" className="text-muted-foreground">Objetivo de Dieta</Label>
                    <Select 
                        value={formData.diet_goal_id || ''} 
                        onValueChange={(v) => handleChange('diet_goal_id', v)}
                    >
                        <SelectTrigger id="diet_goal_id" className="w-full">
                            <SelectValue placeholder="Selecciona un objetivo..." />
                        </SelectTrigger>
                        <SelectContent>
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
                    <Label className="text-muted-foreground">Tipo de Dieta</Label>
                    <DietTypeSelector
                        dietTypes={dietTypes}
                        value={formData.diet_type_id ? String(formData.diet_type_id) : ''}
                        onChange={(v) => handleChange('diet_type_id', v ? parseInt(v, 10) : null)}
                        placeholder="Selecciona un tipo..."
                    />
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
            <FoodRestrictionsForm
              userId={userId}
              onRestrictionsChange={handleRestrictionsChange}
            />
        </FormBlock>

        <FormBlock title="Gustos por Alimentos" icon={Apple} color="green-red">
          <FoodPreferencesForm
            userId={userId}
            selectedConditionIds={selectedMedicalConditionIds}
            userRestrictions={userRestrictionsForFoodSelector}
            excludedFoodIds={allergicFoodIds}
          />
        </FormBlock>
      </div>

    </ProfileSectionCard>
  );
};

export default DietPreferencesForm;
