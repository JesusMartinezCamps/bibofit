import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient';

const MealTypeSelect = ({ value, onValueChange, placeholder = "Seleccionar tipo de comida...", className = "" }) => {
  const [mealTypes, setMealTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMealTypes = async () => {
      try {
        const { data, error } = await supabase
          .from('meal_types')
          .select('*')
          .order('display_order', { ascending: true });

        if (error) throw error;
        setMealTypes(data || []);
      } catch (error) {
        console.error('Error fetching meal types:', error);
        setMealTypes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMealTypes();
  }, []);

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
        {mealTypes.map((mealType) => (
          <SelectItem key={mealType.id} value={mealType.name}>
            {mealType.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default MealTypeSelect;