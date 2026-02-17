import React from 'react';
import { Label } from '@/components/ui/label';

const AdvancedFields = ({ formData, handleChange }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
            <Label htmlFor="aminogram">Aminograma</Label>
            <textarea id="aminogram" name="aminogram" value={formData.aminogram} onChange={handleChange} className="input-field h-32" />
        </div>
        <div className="space-y-2">
            <Label htmlFor="antioxidants">Antioxidantes</Label>
            <textarea id="antioxidants" name="antioxidants" value={formData.antioxidants} onChange={handleChange} className="input-field h-32" />
        </div>
    </div>
  );
};

export default AdvancedFields;