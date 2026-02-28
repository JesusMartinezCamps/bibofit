
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ImagePlus, X, FileImage as ImageIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';

const MAX_SIZE_KB = 100;
const MAX_SIZE_BYTES = MAX_SIZE_KB * 1024;

export const validateWebP = (file) => {
  if (!file) return null;
  if (file.type !== 'image/webp' || !file.name.toLowerCase().endsWith('.webp')) {
    return 'Solo se permiten archivos WebP';
  }
  if (file.size > MAX_SIZE_BYTES) {
    return 'El archivo es demasiado grande (máximo 100KB)';
  }
  return null;
};

const RecipeImageUpload = ({ value, onChange, disabled }) => {
  const [preview, setPreview] = useState(null);
  const [localError, setLocalError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!value) {
      setPreview(null);
    } else if (typeof value === 'string') {
      setPreview(value);
    } else if (value instanceof File) {
      const objectUrl = URL.createObjectURL(value);
      setPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [value]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setLocalError(null);
    
    if (!file) {
      return;
    }

    const validationError = validateWebP(file);
    if (validationError) {
      setLocalError(validationError);
      e.target.value = null;
      return;
    }

    onChange(file);
  };

  const handleRemove = () => {
    onChange(null);
    setLocalError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  return (
    <div className="space-y-2">
      <Label>Imagen de la Receta (Opcional)</Label>
      
      <div className="flex items-start gap-4">
        {preview ? (
          <div className="relative group">
            <div className="w-[100px] h-[100px] rounded-lg overflow-hidden border border-gray-700 bg-[#16191d] flex items-center justify-center">
              <img src={preview} alt="Vista previa" className="w-full h-full object-cover" />
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-transform hover:scale-110"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {value instanceof File && (
              <div className="text-xs text-gray-400 mt-1 text-center truncate w-[100px]">
                {value.name}
                <br/>
                {(value.size / 1024).toFixed(1)} KB
              </div>
            )}
          </div>
        ) : (
          <div className="w-[100px] h-[100px] rounded-lg border border-dashed border-gray-600 bg-[#16191d] flex flex-col items-center justify-center text-gray-500 gap-2">
            <ImageIcon className="w-8 h-8" />
            <span className="text-[10px]">Sin imagen</span>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center gap-2">
          <input
            type="file"
            accept="image/webp"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            className="bg-[#1a1e23] border-gray-700 hover:bg-gray-800 hover:text-gray-100 text-gray-200 w-fit"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <ImagePlus className="w-4 h-4 mr-2" />
            {preview ? 'Cambiar Imagen' : 'Seleccionar Imagen .webp'}
          </Button>
          <p className="text-xs text-gray-400">
            Formato: .webp • Máximo: 100KB
          </p>
          {localError && (
            <p className="text-xs text-red-400 font-medium bg-red-400/10 p-2 rounded-md">
              {localError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecipeImageUpload;
