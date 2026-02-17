import React, { useState, useEffect } from 'react';
import { Input, InputWithUnit } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/contexts/AuthContext';
import { getActivityLevels } from '@/lib/metabolismCalculator';
import { Ruler, Weight, Loader2 } from 'lucide-react';

const PhysicalDataStep = ({ onNext, isLoading }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    birth_date: user?.birth_date || '',
    sex: user?.sex || '',
    height_cm: user?.height_cm || '',
    current_weight_kg: user?.current_weight_kg || '',
    activity_level_id: user?.activity_level_id ? String(user.activity_level_id) : ''
  });
  const [activityLevels, setActivityLevels] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    getActivityLevels().then(setActivityLevels);
  }, []);

  const validate = () => {
    const newErrors = {};
    if (!formData.birth_date) newErrors.birth_date = 'Fecha obligatoria';
    if (!formData.sex) newErrors.sex = 'Selecciona tu sexo';
    if (!formData.height_cm || formData.height_cm <= 0) newErrors.height_cm = 'Altura inválida';
    if (!formData.current_weight_kg || formData.current_weight_kg <= 0) newErrors.current_weight_kg = 'Peso inválido';
    if (!formData.activity_level_id) newErrors.activity_level_id = 'Nivel de actividad obligatorio';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      const payload = {
        ...formData,
        height_cm: parseFloat(formData.height_cm),
        current_weight_kg: parseFloat(formData.current_weight_kg),
        activity_level_id: parseInt(formData.activity_level_id)
      };
      onNext(payload);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="sex" className="text-gray-300">Sexo</Label>
                <Select 
                    value={formData.sex} 
                    onValueChange={(v) => setFormData(prev => ({...prev, sex: v}))}
                >
                    <SelectTrigger id="sex" type="button" className="bg-gray-800/50 border-gray-700 text-white w-full">
                        <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent position="popper" style={{ zIndex: 9999 }} className="bg-gray-800 border-gray-700 text-white">
                        <SelectItem value="Hombre">Hombre</SelectItem>
                        <SelectItem value="Mujer">Mujer</SelectItem>
                    </SelectContent>
                </Select>
                {errors.sex && <p className="text-red-400 text-xs">{errors.sex}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="birth_date" className="text-gray-300">Nacimiento</Label>
                <div className="relative">
                    <Input
                        id="birth_date"
                        type="date"
                        value={formData.birth_date}
                        onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
                        className="bg-gray-800/50 border-gray-700 text-white"
                    />
                </div>
                {errors.birth_date && <p className="text-red-400 text-xs">{errors.birth_date}</p>}
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="height" className="text-gray-300">Altura</Label>
                <div className="relative">
                    <Ruler className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <InputWithUnit
                        id="height"
                        type="number"
                        unit="cm"
                        value={formData.height_cm}
                        onChange={(e) => setFormData({...formData, height_cm: e.target.value})}
                        className="pl-9 bg-gray-800/50 border-gray-700 text-white"
                        placeholder="175"
                    />
                </div>
                {errors.height_cm && <p className="text-red-400 text-xs">{errors.height_cm}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="weight" className="text-gray-300">Peso</Label>
                <div className="relative">
                    <Weight className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <InputWithUnit
                        id="weight"
                        type="number"
                        unit="kg"
                        step="0.1"
                        value={formData.current_weight_kg}
                        onChange={(e) => setFormData({...formData, current_weight_kg: e.target.value})}
                        className="pl-9 bg-gray-800/50 border-gray-700 text-white"
                        placeholder="70.5"
                    />
                </div>
                {errors.current_weight_kg && <p className="text-red-400 text-xs">{errors.current_weight_kg}</p>}
            </div>
        </div>

        <div className="space-y-2">
            <Label htmlFor="activity" className="text-gray-300">Nivel de Actividad</Label>
            <Select 
                value={String(formData.activity_level_id)} 
                onValueChange={(v) => setFormData(prev => ({...prev, activity_level_id: v}))}
            >
                <SelectTrigger id="activity" type="button" className="bg-gray-800/50 border-gray-700 text-white h-auto py-3 w-full">
                    <SelectValue placeholder="Selecciona tu actividad" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white z-[9999] max-h-[200px]">
                    {activityLevels.map(level => (
                        <SelectItem key={level.id} value={String(level.id)} className="py-2">
                            <span className="font-medium block text-sm">{level.name}</span>
                            <span className="text-xs text-gray-400 block truncate max-w-[280px] mt-0.5">{level.description}</span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {errors.activity_level_id && <p className="text-red-400 text-xs">{errors.activity_level_id}</p>}
        </div>
      </div>

      <div className="pt-6 mt-auto shrink-0">
        <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
        >
            {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2"/> Guardando...</>
            ) : 'Siguiente'}
        </Button>
      </div>
    </form>
  );
};

export default PhysicalDataStep;