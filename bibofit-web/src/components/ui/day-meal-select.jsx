import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient';

const DayMealSelect = ({ meals: initialMeals, value, onValueChange, placeholder = "Seleccionar momento...", className = "" }) => {
  const [meals, setMeals] = useState(initialMeals || []);
  const [loading, setLoading] = useState(!initialMeals);

  useEffect(() => {
    if (!initialMeals) {
      const fetchMeals = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('day_meals')
            .select('id, name, display_order')
            .order('display_order', { ascending: true });
          if (error) throw error;
          setMeals(data || []);
        } catch (error) {
          console.error('Error fetching day meals:', error);
          setMeals([]);
        } finally {
          setLoading(false);
        }
      };
      fetchMeals();
    }
  }, [initialMeals]);
  
  useEffect(() => {
    if(initialMeals) {
      setMeals(initialMeals);
      setLoading(false);
    }
  }, [initialMeals])

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Cargando..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {meals.map((meal) => (
          <SelectItem key={meal.id} value={String(meal.id)}>
            {meal.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default DayMealSelect;