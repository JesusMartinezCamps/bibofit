import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const RecipeForm = ({ formData, onFormChange, onSelectChange }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre de la Receta</Label>
        <Input id="name" name="name" value={formData.name} onChange={onFormChange} className="input-field" required />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="prep_time_min">Tiempo (min)</Label>
          <Input id="prep_time_min" name="prep_time_min" type="number" value={formData.prep_time_min} onChange={onFormChange} className="input-field" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="difficulty">Dificultad</Label>
          <Select name="difficulty" value={formData.difficulty} onValueChange={(v) => onSelectChange('difficulty', v)}>
            <SelectTrigger className="input-field">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#282d34] border border-gray-700 text-white z-50">
              <SelectItem value="Fácil" className="focus:bg-gray-700 focus:text-white">Fácil</SelectItem>
              <SelectItem value="Media" className="focus:bg-gray-700 focus:text-white">Media</SelectItem>
              <SelectItem value="Difícil" className="focus:bg-gray-700 focus:text-white">Difícil</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="instructions">Instrucciones</Label>
        <textarea id="instructions" name="instructions" value={formData.instructions} onChange={onFormChange} className="input-field w-full min-h-[80px]"></textarea>
      </div>
    </div>
  );
};

export default RecipeForm;