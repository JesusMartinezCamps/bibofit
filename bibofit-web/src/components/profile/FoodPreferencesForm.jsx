import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import FoodPreferenceSelector from '@/components/profile/FoodPreferenceSelector';

const FoodPreferencesForm = ({ userId, onSaveStatusChange }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  
  const [foods, setFoods] = useState([]);
  const [preferredFoods, setPreferredFoods] = useState([]);
  const [nonPreferredFoods, setNonPreferredFoods] = useState([]);
  const [selectedMedicalConditions, setSelectedMedicalConditions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const [foodsRes, prefRes, nonPrefRes, conditionsRes] = await Promise.all([
            supabase.from('food').select(`
              id,
              name,
              food_to_food_groups(
                food_group_id,
                food_groups(id, name)
              ),
              food_medical_conditions(
                condition_id,
                relation_type,
                medical_conditions(id, name)
              )
            `).order('name'),
            supabase.from('preferred_foods').select('food_id, food(id, name)').eq('user_id', userId),
            supabase.from('non_preferred_foods').select('food_id, food(id, name)').eq('user_id', userId),
            supabase.from('user_medical_conditions').select('condition_id').eq('user_id', userId)
        ]);

        if (foodsRes.data) setFoods(foodsRes.data);
        if (prefRes.data) setPreferredFoods(prefRes.data.map(pf => pf.food).filter(Boolean));
        if (nonPrefRes.data) setNonPreferredFoods(nonPrefRes.data.map(npf => npf.food).filter(Boolean));
        if (conditionsRes.data) setSelectedMedicalConditions(conditionsRes.data.map(condition => condition.condition_id));
      } catch (error) {
        console.error("Error fetching food preferences:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  const foodOptions = useMemo(() => foods
    .filter(food => 
      !preferredFoods.some(pf => pf.id === food.id) && 
      !nonPreferredFoods.some(npf => npf.id === food.id)
    )
    .map(food => ({ value: String(food.id), label: food.name })), 
  [foods, preferredFoods, nonPreferredFoods]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-green-500" /></div>;

  return (
    <div className="grid grid-cols-1 gap-6">
        <FoodPreferenceSelector 
            userId={userId} 
            type="preferred" 
            foodOptions={foodOptions} 
            selectedFoods={preferredFoods} 
            setSelectedFoods={setPreferredFoods} 
            allFoods={foods} 
            selectedConditionIds={selectedMedicalConditions}
        />
        <FoodPreferenceSelector 
            userId={userId} 
            type="non-preferred" 
            foodOptions={foodOptions} 
            selectedFoods={nonPreferredFoods} 
            setSelectedFoods={setNonPreferredFoods} 
            allFoods={foods} 
            selectedConditionIds={selectedMedicalConditions}
        />
    </div>
  );
};

export default FoodPreferencesForm;
