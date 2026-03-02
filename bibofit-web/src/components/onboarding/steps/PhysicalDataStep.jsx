import React, { useState, useEffect } from 'react';
import { Input, InputWithUnit } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/contexts/AuthContext';
import { getActivityLevels } from '@/lib/metabolismCalculator';
import { Ruler, Weight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import UnifiedDatePicker from '@/components/shared/UnifiedDatePicker';

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
                <Label htmlFor="sex" className="text-muted-foreground">Sexo</Label>
                <Select 
                    value={formData.sex} 
                    onValueChange={(v) => setFormData(prev => ({...prev, sex: v}))}
                >
                    <SelectTrigger id="sex" type="button" className="w-full">
                        <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Hombre">Hombre</SelectItem>
                        <SelectItem value="Mujer">Mujer</SelectItem>
                    </SelectContent>
                </Select>
                {errors.sex && <p className="text-red-400 text-xs">{errors.sex}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="birth_date" className="text-muted-foreground">Nacimiento</Label>
                <div className="relative">
                    <UnifiedDatePicker
                        id="birth_date"
                        selected={formData.birth_date ? new Date(`${formData.birth_date}T00:00:00`) : null}
                        onChange={(date) => setFormData((prev) => ({
                          ...prev,
                          birth_date: date ? format(date, 'yyyy-MM-dd') : '',
                        }))}
                        placeholder="Selecciona tu fecha"
                        maxDate={new Date()}
                        minYear={1920}
                        maxYear={new Date().getFullYear()}
                    />
                </div>
                {errors.birth_date && <p className="text-red-400 text-xs">{errors.birth_date}</p>}
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="height" className="text-muted-foreground">Altura</Label>
                <div className="relative">                    
                    <InputWithUnit
                        id="height"
                        type="number"
                        unit="cm"
                        value={formData.height_cm}
                        onChange={(e) => setFormData({...formData, height_cm: e.target.value})}
                        className="pl-12 bf-form-control"
                        placeholder="175"
                    />
                </div>
                {errors.height_cm && <p className="text-red-400 text-xs">{errors.height_cm}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="weight" className="text-muted-foreground">Peso</Label>
                <div className="relative">
                    <InputWithUnit
                        id="weight"
                        type="number"
                        unit="kg"
                        step="0.1"
                        value={formData.current_weight_kg}
                        onChange={(e) => setFormData({...formData, current_weight_kg: e.target.value})}
                        className="pl-12 bf-form-control"
                        placeholder="70.5"
                    />
                </div>
                {errors.current_weight_kg && <p className="text-red-400 text-xs">{errors.current_weight_kg}</p>}
            </div>
        </div>

        <div className="space-y-2">
            <Label htmlFor="activity" className="text-muted-foreground">Nivel de Actividad</Label>
            <Select 
                value={String(formData.activity_level_id)} 
                onValueChange={(v) => setFormData(prev => ({...prev, activity_level_id: v}))}
            >
                <SelectTrigger id="activity" type="button" className="h-auto py-3 w-full">
                    <SelectValue placeholder="Selecciona tu actividad" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                    {activityLevels.map(level => (
                        <SelectItem key={level.id} value={String(level.id)} className="py-2">
                            <span className="font-medium block text-sm">{level.name}</span>
                            <span className="text-xs text-muted-foreground block truncate max-w-[280px] mt-0.5">{level.description}</span>
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
