import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DayMealSelect from '@/components/ui/day-meal-select';

const RecipeForm = ({
  formData,
  mealId,
  allDayMeals,
  dietPlanRecipeId,
  userId,
  onFormChange,
  onSelectChange,
  onMealIdChange
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`space-y-2 ${!dietPlanRecipeId ? 'md:col-span-2' : ''}`}>
          <Label htmlFor="name">Nombre de la Receta</Label>
          <Input 
            id="name" 
            name="name" 
            value={formData.name} 
            onChange={onFormChange} 
            
            required 
          />
        </div>
        {dietPlanRecipeId && (
          <div className="space-y-2">
            <Label htmlFor="meal_name">Momento del Día</Label>
            <DayMealSelect
              meals={allDayMeals}
              value={mealId ? String(mealId) : ''}
              onValueChange={(value) => onMealIdChange(Number(value))}
              placeholder="Seleccionar momento del día..."
             
            />
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="prep_time_min">Tiempo (min)</Label>
          <Input 
            id="prep_time_min" 
            name="prep_time_min" 
            type="number" 
            min="0"
            value={formData.prep_time_min} 
            onChange={onFormChange} 
            
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="difficulty">Dificultad</Label>
          <Select 
            name="difficulty" 
            value={formData.difficulty || 'Fácil'} 
            onValueChange={(v) => onSelectChange('difficulty', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Fácil" className="focus:bg-muted focus:text-white">Fácil</SelectItem>
              <SelectItem value="Media" className="focus:bg-muted focus:text-white">Media</SelectItem>
              <SelectItem value="Difícil" className="focus:bg-muted focus:text-white">Difícil</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="instructions">Instrucciones</Label>
        <Textarea 
          id="instructions" 
          name="instructions" 
          value={formData.instructions} 
          onChange={onFormChange} 
          className="input-field w-full min-h-[80px]"
        />
      </div>
    </div>
  );
};

export default RecipeForm;