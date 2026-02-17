import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import NutrientSummary from './NutrientSummary';

const RecipeDataForm = ({
  formData,
  onFormChange,
  allVitamins,
  allMinerals,
  recipeNutrients,
  macros
}) => {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onFormChange({ ...formData, [name]: value });
  };

  const handleSelectChange = (name, value) => {
    onFormChange({ ...formData, [name]: value });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 p-4 rounded-lg bg-slate-900/50 border border-slate-800">
        <h4 className="text-lg font-semibold text-green-400">Datos de la Receta</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Receta</Label>
            <Input id="name" name="name" value={formData.name || ''} onChange={handleInputChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prep_time_min">Tiempo (min)</Label>
            <Input id="prep_time_min" name="prep_time_min" type="number" value={formData.prep_time_min || ''} onChange={handleInputChange} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="difficulty">Dificultad</Label>
            <Select name="difficulty" value={formData.difficulty || ''} onValueChange={(value) => handleSelectChange('difficulty', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona dificultad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Fácil">Fácil</SelectItem>
                <SelectItem value="Media">Media</SelectItem>
                <SelectItem value="Difícil">Difícil</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="instructions">Instrucciones</Label>
            <Textarea id="instructions" name="instructions" value={formData.instructions || ''} onChange={handleInputChange} rows={6} />
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
        <NutrientSummary
          macros={macros}
          allVitamins={allVitamins}
          allMinerals={allMinerals}
          recipeNutrients={recipeNutrients}
        />
      </div>
    </div>
  );
};

export default RecipeDataForm;