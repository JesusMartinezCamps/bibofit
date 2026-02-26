import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Trash2, PlusCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { debounce } from 'lodash';

const DayMealsPreferencesForm = ({ userId }) => {
  const { toast } = useToast();
  const [dayMeals, setDayMeals] = useState([]);
  const [allDayMeals, setAllDayMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'

  const findDefaultMeal = useCallback((meals) => {
    if (!Array.isArray(meals) || meals.length === 0) return null;

    const breakfastByExactName = meals.find(
      (meal) => meal.name?.trim().toLowerCase() === 'desayuno'
    );
    if (breakfastByExactName) return breakfastByExactName;

    const breakfastByPartialName = meals.find(
      (meal) => meal.name?.toLowerCase().includes('desayuno')
    );
    if (breakfastByPartialName) return breakfastByPartialName;

    return [...meals].sort((a, b) => a.display_order - b.display_order)[0];
  }, []);

  const fetchDayMeals = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Fetch user meals for BASE CONFIG (diet_plan_id is null)
      const [userMealsRes, allMealsRes] = await Promise.all([
        supabase.from('user_day_meals')
            .select('*, day_meals(name, description, display_order)')
            .eq('user_id', userId)
            .is('diet_plan_id', null), // ONLY Base config
        supabase.from('day_meals').select('*').order('display_order', { ascending: true })
      ]);

      if (userMealsRes.error) throw userMealsRes.error;
      if (allMealsRes.error) throw allMealsRes.error;

      const allMeals = allMealsRes.data || [];
      let sortedUserMeals = (userMealsRes.data || []).sort((a, b) => a.day_meals.display_order - b.day_meals.display_order);

      // Business rule: there must be at least one default meal, preferably "Desayuno".
      if (sortedUserMeals.length === 0 && allMeals.length > 0) {
        const defaultMeal = findDefaultMeal(allMeals);
        if (defaultMeal) {
          const { data: insertedMeal, error: insertError } = await supabase
            .from('user_day_meals')
            .insert({
              user_id: userId,
              day_meal_id: defaultMeal.id,
              preferences: '',
              diet_plan_id: null,
            })
            .select('id')
            .single();

          if (insertError) throw insertError;

          sortedUserMeals = [{
            id: insertedMeal.id,
            user_id: userId,
            day_meal_id: defaultMeal.id,
            preferences: '',
            diet_plan_id: null,
            day_meals: {
              name: defaultMeal.name,
              description: defaultMeal.description,
              display_order: defaultMeal.display_order,
            },
          }];
        }
      }

      setDayMeals(sortedUserMeals);
      setAllDayMeals(allMeals);
    } catch (error) {
      console.error("Error fetching day meals:", error);
      toast({ title: 'Error', description: 'No se pudieron cargar las comidas del día.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [userId, toast, findDefaultMeal]);

  useEffect(() => {
    fetchDayMeals();
  }, [fetchDayMeals]);

  const performSave = useCallback(async (currentMeals) => {
    if (!userId) return;
    setSaveStatus('saving');
    try {
        // 1. Get existing IDs currently in UI
        const currentMealIds = currentMeals.map(m => m.id).filter(Boolean);

        // 2. Fetch existing DB rows for this user (Base config only)
        const { data: existingRows, error: fetchError } = await supabase
            .from('user_day_meals')
            .select('id')
            .eq('user_id', userId)
            .is('diet_plan_id', null);
            
        if (fetchError) throw fetchError;
        
        const existingRowIds = existingRows.map(r => r.id);
        
        // 3. Determine items to delete (In DB but not in UI)
        const idsToDelete = existingRowIds.filter(id => !currentMealIds.includes(id));
        
        if (idsToDelete.length > 0) {
            const { error: deleteError } = await supabase
                .from('user_day_meals')
                .delete()
                .in('id', idsToDelete);
            
            if (deleteError) throw deleteError;
        }

        // 4. Update or Insert items
        const upsertPromises = currentMeals.map(meal => {
            const payload = {
                user_id: userId,
                day_meal_id: meal.day_meal_id,
                preferences: meal.preferences || '',
                target_calories: meal.target_calories ?? null,
                target_proteins: meal.target_proteins ?? null,
                target_carbs: meal.target_carbs ?? null,
                target_fats: meal.target_fats ?? null,
                protein_pct: meal.protein_pct ?? null,
                carbs_pct: meal.carbs_pct ?? null,
                fat_pct: meal.fat_pct ?? null,
                diet_plan_id: null // Explicitly NULL for base config
            };
            
            if (meal.id) {
                // Update existing
                return supabase.from('user_day_meals').update(payload).eq('id', meal.id).select('id').single();
            } else {
                // Insert new
                return supabase.from('user_day_meals').insert(payload).select('id').single();
            }
        });
        
        const results = await Promise.all(upsertPromises);
        const hasErrors = results.some(r => r.error);
        
        if (hasErrors) throw new Error("Error updating some meals");

        // 5. Update local state with new IDs for inserted items
        setDayMeals(prevMeals => {
             return prevMeals.map((meal, index) => {
                 const result = results[index];
                 if (result.data && !meal.id) {
                     return { ...meal, id: result.data.id };
                 }
                 return meal;
             });
        });

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);

    } catch (error) {
        console.error("Error saving day meals:", error);
        setSaveStatus('error');
        toast({ title: 'Error', description: 'No se pudieron guardar los cambios.', variant: 'destructive' });
    }
  }, [userId, toast]);

  const debouncedSave = useMemo(
    () => debounce((meals) => performSave(meals), 1000),
    [performSave]
  );

  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const updateMeals = (newMeals) => {
      setDayMeals(newMeals);
      debouncedSave(newMeals);
  };

  const handleAddMeal = () => {
    const availableMeals = allDayMeals.filter(meal => !dayMeals.some(dm => dm.day_meal_id === meal.id));
    if (availableMeals.length === 0) {
      toast({ title: 'Aviso', description: 'No hay más tipos de comida para añadir.' });
      return;
    }
    const newMeal = availableMeals[0];
    const newMealData = {
        tempId: Date.now(), 
        user_id: userId,
        day_meal_id: newMeal.id,
        preferences: '',
        day_meals: { 
            name: newMeal.name, 
            description: newMeal.description,
            display_order: newMeal.display_order 
        }
    };
    
    const newMealsList = [...dayMeals, newMealData].sort((a, b) => a.day_meals.display_order - b.day_meals.display_order);
    updateMeals(newMealsList);
  };

  const handleRemoveMeal = (mealId, index) => {
    if (index === 0) {
      toast({ title: 'Aviso', description: 'La primera comida del día no se puede eliminar.' });
      return;
    }

    if (dayMeals.length <= 1) {
      toast({ title: 'Aviso', description: 'Debe quedar al menos una comida.' });
      return;
    }

    const newMealsList = dayMeals.filter(meal => meal.day_meal_id !== mealId);
    updateMeals(newMealsList);
  };

  const handlePreferenceChange = (mealId, value) => {
    const newMealsList = dayMeals.map(meal => meal.day_meal_id === mealId ? { ...meal, preferences: value } : meal);
    updateMeals(newMealsList);
  };

  const handleMealTypeChange = (oldMealId, newMealId) => {
    if (dayMeals.some(dm => dm.day_meal_id === newMealId)) {
        toast({ title: 'Error', description: 'Este tipo de comida ya está en uso.', variant: 'destructive' });
        return;
    }
    const newMealDetails = allDayMeals.find(m => m.id === newMealId);
    if (!newMealDetails) return;

    const newMealsList = dayMeals
        .map(meal => meal.day_meal_id === oldMealId ? { 
            ...meal, 
            day_meal_id: newMealId, 
            day_meals: { 
                name: newMealDetails.name, 
                description: newMealDetails.description,
                display_order: newMealDetails.display_order 
            } 
        } : meal)
        .sort((a, b) => a.day_meals.display_order - b.day_meals.display_order);
    
    updateMeals(newMealsList);
  };

  if (loading) return <div className="flex justify-center items-center h-20"><Loader2 className="h-6 w-6 animate-spin text-yellow-500" /></div>;

  return (
    <div className="space-y-6 relative">
      <div className="absolute -top-10 right-0 flex items-center gap-2">
          {saveStatus === 'saving' && <span className="text-xs text-yellow-500 flex items-center"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Guardando...</span>}
          {saveStatus === 'saved' && <span className="text-xs text-green-500 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Guardado</span>}
      </div>

      <p className="text-sm text-gray-400 -mt-4">Configura las comidas que realizas a lo largo del día y tus preferencias para cada una.</p>
      
      <div className="space-y-4">
        {dayMeals.map((meal, index) => {
          const availableOptions = allDayMeals.filter(
            (option) => option.id === meal.day_meal_id || !dayMeals.some(dm => dm.day_meal_id === option.id)
          );
          
          const key = meal.id || meal.tempId || `new-${meal.day_meal_id}`;
          
          // Construct dynamic placeholder using both name and description if available
          const description = meal.day_meals?.description;
          const placeholderText = description 
            ? `${meal.day_meals.name} - ${description}`
            : `Preferencias para ${meal.day_meals.name}...`;

          const isDeleteDisabled = index === 0 || dayMeals.length <= 1;

          return (
            <div key={key} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-3">
              <div className="flex items-center justify-between">
                <Select
                  value={String(meal.day_meal_id)}
                  onValueChange={(newId) => handleMealTypeChange(meal.day_meal_id, parseInt(newId))}
                >
                  <SelectTrigger className="w-48 border-gray-600 bg-gray-900/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOptions.map(option => (
                      <SelectItem key={option.id} value={String(option.id)}>{option.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveMeal(meal.day_meal_id, index)}
                  disabled={isDeleteDisabled}
                  className="text-red-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                placeholder={placeholderText}
                value={meal.preferences || ''}
                onChange={(e) => handlePreferenceChange(meal.day_meal_id, e.target.value)}
                className="bg-gray-900/50 border-gray-600 placeholder:text-gray-500"
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-end items-center pt-4">
        <Button type="button" variant="outline" onClick={handleAddMeal} className="border-dashed border-yellow-500 text-yellow-300 bg-yellow-900/20 hover:bg-yellow-500/20 hover:text-yellow-300">
          <PlusCircle className="mr-2 h-4 w-4" /> Añadir Momento del día
        </Button>
      </div>
    </div>
  );
};

export default DayMealsPreferencesForm;
