import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { User, Phone } from 'lucide-react';

const PersonalDataStep = ({ onNext, isLoading }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || ''
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'El nombre es obligatorio';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onNext(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        <div className="space-y-2">
            <Label htmlFor="full_name" className="text-gray-300">Nombre Completo</Label>
            <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="pl-9 bg-gray-800/50 border-gray-700 text-white"
                    placeholder="Tu nombre"
                />
            </div>
            {errors.full_name && <p className="text-red-400 text-sm mt-1">{errors.full_name}</p>}
        </div>

        <div className="space-y-2">
            <Label htmlFor="phone" className="text-gray-300">Teléfono (Opcional)</Label>
            <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="pl-9 bg-gray-800/50 border-gray-700 text-white"
                    placeholder="+34 600 000 000"
                />
            </div>
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