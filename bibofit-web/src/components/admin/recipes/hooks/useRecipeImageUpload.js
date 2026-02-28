
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export const useRecipeImageUpload = () => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadRecipeImage = async (recipeId, file) => {
    setIsUploading(true);
    try {
      const filePath = `${recipeId}/main.webp`;
      
      const { error: uploadError } = await supabase.storage
        .from('recipe-images')
        .upload(filePath, file, { 
          upsert: true, 
          contentType: 'image/webp' 
        });

      if (uploadError) {
        let errorMessage = 'Error al subir la imagen. Por favor, intenta de nuevo.';
        if (uploadError.message.includes('permission denied') || uploadError.message.includes('new row violates row-level security')) {
          errorMessage = 'Permiso denegado para subir la imagen. Verifica las políticas de Storage.';
        } else if (uploadError.message.includes('Failed to fetch')) {
          errorMessage = 'Error de conexión. Por favor, verifica tu conexión a internet.';
        }
        return { success: false, imageUrl: null, error: errorMessage };
      }

      const { data: { publicUrl } } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(filePath);

      return { success: true, imageUrl: publicUrl, error: null };
    } catch (err) {
      return { success: false, imageUrl: null, error: err.message || 'Error desconocido' };
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadRecipeImage, isUploading };
};
