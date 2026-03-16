import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, Ruler, ImagePlus, X, Shield } from 'lucide-react';
import ProfileSectionCard from '@/components/profile/ProfileSectionCard.jsx';
import FormRow from '@/components/profile/FormRow.jsx';
import { calculateAndSaveMetabolism, getActivityLevels } from '@/lib/metabolismCalculator';
import { format } from 'date-fns';
import FormBlock from '@/components/profile/FormBlock';
import { isValidProfileImage, optimizeProfileImage } from '@/lib/profileImageUtils';
import AccountSecurityForm from '@/components/profile/AccountSecurityForm.jsx';

const splitFullName = (fullName = '') => {
  const cleanedName = fullName.trim().replace(/\s+/g, ' ');
  if (!cleanedName) {
    return { firstName: '', lastName: '' };
  }
  const [firstName, ...rest] = cleanedName.split(' ');
  return { firstName, lastName: rest.join(' ') };
};

const PersonalDataForm = ({ className, onSave, userId: propUserId }) => {
  const { user: authUser, refreshUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [activityLevels, setActivityLevels] = useState([]);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const avatarInputRef = useRef(null);
  
  const userId = propUserId || authUser?.id;
  const isOwnProfile = !propUserId || propUserId === authUser?.id;

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    full_name: '',
    avatar_url: '',
    email: '',
    sex: '',
    birth_date: '',
    height_cm: '',
    current_weight_kg: '',
    goal_weight_kg: '',
    activity_level_id: '',
    phone: '',
    city: ''
  });

  // Store initial data to check for changes
  const [initialFormData, setInitialFormData] = useState({});

  const fetchActivityLevels = useCallback(async () => {
    try {
      const levels = await getActivityLevels();
      setActivityLevels(levels);
    } catch (error) {
      console.error('Error fetching activity levels:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      
      await fetchActivityLevels();
      
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          activity_levels(id, name, description, factor)
        `)
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        const mappedData = {
          first_name: data.first_name || splitFullName(data.full_name || '').firstName,
          last_name: data.last_name || splitFullName(data.full_name || '').lastName,
          full_name: data.full_name || '',
          avatar_url: data.avatar_url || '',
          email: isOwnProfile ? (authUser?.email || data.email || '') : (data.email || authUser?.email || ''),
          sex: data.sex || '',
          birth_date: data.birth_date || '',
          height_cm: data.height_cm ? data.height_cm.toString() : '',
          current_weight_kg: data.current_weight_kg ? data.current_weight_kg.toString() : '',
          goal_weight_kg: data.goal_weight_kg ? data.goal_weight_kg.toString() : '',
          activity_level_id: data.activity_level_id ? data.activity_level_id.toString() : '',
          phone: data.phone || '',
          city: data.city || ''
        };
        setFormData(mappedData);
        setInitialFormData(mappedData);
        setAvatarFile(null);
      } else {
        const defaultData = {
          first_name: '',
          last_name: '',
          full_name: '',
          avatar_url: '',
          email: isOwnProfile ? (authUser?.email || '') : (authUser?.email || ''),
          sex: '',
          birth_date: '',
          height_cm: '',
          current_weight_kg: '',
          goal_weight_kg: '',
          activity_level_id: '',
          phone: '',
          city: ''
        };
        setFormData(defaultData);
        setInitialFormData(defaultData);
        setAvatarFile(null);
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los datos personales.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [userId, toast, fetchActivityLevels, authUser?.email, isOwnProfile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (avatarFile instanceof File) {
      const objectUrl = URL.createObjectURL(avatarFile);
      setAvatarPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setAvatarPreview(formData.avatar_url || '');
    return undefined;
  }, [avatarFile, formData.avatar_url]);

  const handleChange = (id, value) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleAvatarChange = async (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) return;

    const validationError = isValidProfileImage(selectedFile);
    if (validationError) {
      toast({ title: 'Archivo inválido', description: validationError, variant: 'destructive' });
      return;
    }

    setIsImageProcessing(true);
    try {
      const optimizedImage = await optimizeProfileImage(selectedFile);
      setAvatarFile(optimizedImage);
    } catch (error) {
      toast({
        title: 'Error de imagen',
        description: error?.message || 'No se pudo procesar la foto de perfil.',
        variant: 'destructive'
      });
    } finally {
      setIsImageProcessing(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setFormData((prev) => ({ ...prev, avatar_url: '' }));
  };

  /**
   * Smart parser for height input.
   * Accepts formats: "1.69", "169", "1,69", "1 69", "1'69"
   * Returns: integer in cm (e.g., 169) or null if invalid
   */
  const normalizeHeight = (input) => {
    if (!input) return null;
    
    // Convert to string and clean up common separators to dots
    let cleanStr = String(input).trim().replace(/,/g, '.').replace(/'/g, '.').replace(/\s/g, '');
    
    // If it contains a dot, it might be meters (e.g. 1.69) or weird format
    if (cleanStr.includes('.')) {
       const parts = cleanStr.split('.');
       if (parts.length > 2) return null; // Too many dots

       const meters = parseFloat(cleanStr);
       if (isNaN(meters)) return null;

       // Heuristic: if value is small (e.g., < 3.0), assume meters and convert to cm
       // Example: 1.69 -> 169, 2.10 -> 210.
       // If someone enters 1.6 (meaning 1m 60cm), parseFloat gives 1.6 -> 160cm
       if (meters < 3.0) {
         return Math.round(meters * 100);
       } else {
         // If value is large (e.g., 169.5), just round it
         return Math.round(meters);
       }
    }

    // No dot, parse as integer
    const cm = parseInt(cleanStr, 10);
    if (isNaN(cm)) return null;

    return cm;
  };

  /**
   * Helper function to check if any metabolism-related fields have changed
   * Compares: weight, height, birth_date, sex, activity_level_id
   */
  const hasMetabolismFieldsChanged = (initial, current) => {
    return (
      initial.current_weight_kg !== current.current_weight_kg ||
      initial.height_cm !== current.height_cm ||
      initial.birth_date !== current.birth_date ||
      initial.sex !== current.sex ||
      initial.activity_level_id !== current.activity_level_id
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const heightCm = normalizeHeight(formData.height_cm);
      const firstName = formData.first_name.trim();
      const lastName = formData.last_name.trim();
      const fullName = `${firstName} ${lastName}`.trim();

      let avatarUrl = formData.avatar_url || null;
      if (avatarFile instanceof File) {
        const avatarPath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
        const { error: uploadError } = await supabase.storage
          .from('profile-images')
          .upload(avatarPath, avatarFile, {
            contentType: 'image/webp',
            upsert: false
          });
        if (uploadError) {
          throw new Error(`No se pudo subir la foto de perfil: ${uploadError.message}`);
        }
        const { data: { publicUrl } } = supabase.storage
          .from('profile-images')
          .getPublicUrl(avatarPath);
        avatarUrl = publicUrl;
      }

      const profileData = {
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: fullName || formData.full_name || null,
        avatar_url: avatarUrl,
        sex: formData.sex || null,
        birth_date: formData.birth_date || null,
        height_cm: heightCm,
        current_weight_kg: formData.current_weight_kg ? parseFloat(formData.current_weight_kg) : null,
        goal_weight_kg: formData.goal_weight_kg ? parseFloat(formData.goal_weight_kg) : null,
        activity_level_id: formData.activity_level_id ? parseInt(formData.activity_level_id, 10) : null,
        phone: formData.phone || null,
        city: formData.city || null
      };
      if (!isOwnProfile) {
        profileData.email = formData.email || null;
      }

      // Use update instead of upsert because the profile is guaranteed to exist for any valid user
      const { error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('user_id', userId);
      
      if (error) throw error;

      const { data: refreshedProfile, error: refreshedProfileError } = await supabase
              .from('profiles')
              .select(`
                *,
                activity_levels(factor)
              `)
              .eq('user_id', userId)
              .single();

      if (refreshedProfileError) throw refreshedProfileError;
      
      // Check if weight has changed compared to initial loaded data
      const weightHasChanged = formData.current_weight_kg !== initialFormData.current_weight_kg;

      // Smartly update today's weight log ONLY if weight has changed and is valid
      if (weightHasChanged && profileData.current_weight_kg) {
        const today = format(new Date(), 'yyyy-MM-dd');
        
        // 1. Check if a log already exists for today
        const { data: existingLog, error: fetchError } = await supabase
          .from('weight_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('logged_on', today)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (existingLog) {
            // 2. Update existing log
            const { error: updateLogError } = await supabase
                .from('weight_logs')
                .update({
                    weight_kg: profileData.current_weight_kg,
                    description: 'Peso actualizado desde el perfil.'
                })
                .eq('id', existingLog.id);
            
            if (updateLogError) throw updateLogError;
        } else {
            // 3. Insert new log
            const { error: insertLogError } = await supabase
                .from('weight_logs')
                .insert({ 
                  user_id: userId,
                  logged_on: today,
                  weight_kg: profileData.current_weight_kg,
                  description: 'Peso actualizado desde el perfil.'
                });
            
            if (insertLogError) throw insertLogError;
        }
      }

      // Create comparison objects for metabolism fields check
      const initialMetabolismFields = {
        current_weight_kg: initialFormData.current_weight_kg,
        height_cm: initialFormData.height_cm,
        birth_date: initialFormData.birth_date,
        sex: initialFormData.sex,
        activity_level_id: initialFormData.activity_level_id
      };

      const currentMetabolismFields = {
        current_weight_kg: refreshedProfile.current_weight_kg ? refreshedProfile.current_weight_kg.toString() : '',
        height_cm: refreshedProfile.height_cm ? refreshedProfile.height_cm.toString() : '',
        birth_date: refreshedProfile.birth_date || '',
        sex: refreshedProfile.sex || '',
        activity_level_id: refreshedProfile.activity_level_id ? refreshedProfile.activity_level_id.toString() : ''
      };

      // Check if metabolism-related fields have changed
      const shouldRecalculateMetabolism = hasMetabolismFieldsChanged(initialMetabolismFields, currentMetabolismFields);

      let metabolismResult = null;
      if (shouldRecalculateMetabolism) {
        // Recalculate metabolism because relevant fields changed
        metabolismResult = await calculateAndSaveMetabolism(userId, refreshedProfile);
      }

      // Check for missing fields for warning message (independent of recalculation)
      const missingFields = [];
      if (!refreshedProfile?.current_weight_kg) missingFields.push('peso');
      if (!refreshedProfile?.height_cm) missingFields.push('altura');
      if (!refreshedProfile?.birth_date) missingFields.push('fecha de nacimiento');
      if (!refreshedProfile?.sex) missingFields.push('sexo');
      if (!refreshedProfile?.activity_levels?.factor) missingFields.push('nivel de actividad');
      
      // Update initial form data to reflect saved state, including normalized height
      const updatedFormData = { 
        ...formData, 
        first_name: refreshedProfile.first_name || firstName,
        last_name: refreshedProfile.last_name || lastName,
        full_name: refreshedProfile.full_name || fullName,
        avatar_url: refreshedProfile.avatar_url || avatarUrl || '',
        email: isOwnProfile
          ? (authUser?.email || refreshedProfile.email || '')
          : (refreshedProfile.email || formData.email || ''),
        height_cm: heightCm ? heightCm.toString() : '',
        current_weight_kg: refreshedProfile.current_weight_kg ? refreshedProfile.current_weight_kg.toString() : '',
        activity_level_id: refreshedProfile.activity_level_id ? refreshedProfile.activity_level_id.toString() : '',
        birth_date: refreshedProfile.birth_date || ''
      };
      setFormData(updatedFormData);
      setInitialFormData(updatedFormData);
      setAvatarFile(null);

      // Show appropriate toast message
      if (shouldRecalculateMetabolism && metabolismResult?.success) {
        if (missingFields.length > 0) {
          toast({ 
            title: 'Datos guardados y metabolismo recalculado', 
            description: `Completa ${missingFields.join(', ')} para un cálculo más preciso.`,
            variant: 'default'
          });
        } else {
          toast({
            title: 'Éxito',
            description: 'Datos personales guardados y metabolismo recalculado correctamente.',
            variant: 'success'
          });
        }
      } else if (shouldRecalculateMetabolism && metabolismResult && !metabolismResult.success) {
        toast({ 
          title: 'Datos guardados', 
          description: 'Datos personales guardados, pero no se pudo recalcular el metabolismo.',
          variant: 'default'
        });
      } else if (!shouldRecalculateMetabolism) {
        if (missingFields.length > 0) {
          toast({ 
            title: 'Datos guardados', 
            description: `Completa ${missingFields.join(', ')} para calcular tu metabolismo.`,
            variant: 'default'
          });
        } else {
          toast({
            title: 'Datos guardados',
            description: 'Datos personales actualizados correctamente.',
            variant: 'success'
          });
        }
      }
      
      if (onSave) {
        onSave();
      }

      if (authUser?.id && authUser.id === userId) {
        await refreshUser();
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Error',
        description: error?.message || 'No se pudieron guardar los datos.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const activityLevelOptions = activityLevels.map(level => ({
    value: level.id.toString(),
    label: `${level.name} - ${level.description}`
  }));

  return (
    <ProfileSectionCard title="Datos Personales" icon={User} color="purple" className={className}>
      <form onSubmit={handleSubmit} className="space-y-8">
        <FormBlock title="Información de Contacto" icon={User} color="purple">
            <div className="rounded-xl border border-border/60 bg-muted/25 p-4">
              <p className="mb-3 text-sm font-medium text-muted-foreground">Foto de perfil</p>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-muted">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Vista previa de perfil" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-border bg-background hover:bg-muted"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isImageProcessing || isSubmitting}
                    >
                      {isImageProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <ImagePlus className="mr-2 h-4 w-4" />
                          Subir foto
                        </>
                      )}
                    </Button>
                    {(avatarPreview || formData.avatar_url) && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={handleRemoveAvatar}
                        disabled={isSubmitting}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Quitar
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se redimensiona automáticamente a formato cuadrado pequeño (WebP) para optimizar carga.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormRow id="first_name" label="Nombre" value={formData.first_name} onChange={handleChange} />
                <FormRow id="last_name" label="Apellidos" value={formData.last_name} onChange={handleChange} />
                <FormRow id="phone" label="Teléfono" value={formData.phone} onChange={handleChange} />
                <FormRow id="city" label="Ciudad" value={formData.city} onChange={handleChange} />
            </div>
        </FormBlock>

        <FormBlock title="Datos Físicos" icon={Ruler} color="purple">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormRow 
                    id="sex" 
                    label="Sexo" 
                    type="select" 
                    value={formData.sex} 
                    onChange={handleChange}
                    options={[{value: 'Hombre', label: 'Hombre'}, {value: 'Mujer', label: 'Mujer'}]} 
                />
                <FormRow id="birth_date" label="Fecha de Nacimiento" type="date" value={formData.birth_date} onChange={handleChange} />
                <FormRow 
                  id="height_cm" 
                  label="Altura" 
                  type="text" 
                  placeholder="Ej: 169, 1.69, 1'69..."
                  value={formData.height_cm} 
                  onChange={handleChange} 
                />
                <FormRow id="current_weight_kg" label="Peso Actual (kg)" type="number" step="0.1" value={formData.current_weight_kg} onChange={handleChange} />
                <FormRow id="goal_weight_kg" label="Peso Objetivo (kg)" type="number" step="0.1" value={formData.goal_weight_kg} onChange={handleChange} />
            </div>
            <div className="w-full pt-4">
                <FormRow 
                    id="activity_level_id" 
                    label="Nivel de Actividad" 
                    type="select" 
                    value={formData.activity_level_id} 
                    onChange={handleChange}
                    options={activityLevelOptions}
                />
            </div>
        </FormBlock>

        {isOwnProfile && (
          <FormBlock title="Seguridad de la Cuenta" icon={Shield} color="purple">
            <AccountSecurityForm
              currentEmail={authUser?.email || formData.email || ''}
              disabled={isSubmitting || isImageProcessing}
              onCredentialsUpdated={refreshUser}
            />
          </FormBlock>
        )}

        <Button type="submit" className="w-full text-lg font-semibold py-6 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 transition-all duration-300" disabled={isSubmitting || isImageProcessing}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar Datos Personales'}
        </Button>
      </form>
    </ProfileSectionCard>
  );
};

export default PersonalDataForm;
