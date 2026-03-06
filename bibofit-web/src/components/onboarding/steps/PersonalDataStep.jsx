import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const PersonalDataStep = ({ onNext, isLoading }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || ''
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.first_name.trim()) newErrors.first_name = 'El nombre es obligatorio';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      const firstName = formData.first_name.trim();
      const lastName = formData.last_name.trim();
      onNext({
        first_name: firstName,
        last_name: lastName,
        phone: formData.phone
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        <div className="space-y-2">
            <Label htmlFor="first_name" className="text-muted-foreground">Nombre</Label>
            <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                className="bf-form-control"
                placeholder="Tu nombre"
            />
            {errors.first_name && <p className="text-red-400 text-sm mt-1">{errors.first_name}</p>}
        </div>

        <div className="space-y-2">
            <Label htmlFor="last_name" className="text-muted-foreground">Apellidos</Label>
            <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                className="bf-form-control"
                placeholder="Tus apellidos"
            />
        </div>

        <div className="space-y-2">
            <Label htmlFor="phone" className="text-muted-foreground">Teléfono (Opcional)</Label>
            <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="bf-form-control"
                placeholder="+34 600 000 000"
            />
        </div>
      </div>

      <div className="pt-6 mt-auto shrink-0">
        <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
        >
            {isLoading ? 'Guardando...' : 'Siguiente'}
        </Button>
      </div>
    </form>
  );
};

export default PersonalDataStep;
