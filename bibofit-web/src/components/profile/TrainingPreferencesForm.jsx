import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Dumbbell, Target, Repeat } from 'lucide-react';
import ProfileSectionCard from '@/components/profile/ProfileSectionCard.jsx';
import FormRow from '@/components/profile/FormRow.jsx';
import FormBlock from '@/components/profile/FormBlock';

const TrainingPreferencesForm = ({ userId: propUserId, onUpdate }) => {
  const { user: authUser } = useAuth();
  const userId = propUserId || authUser?.id;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    sessions_per_week: '',
    training_goal: '',
    discomforts: '',
    training_location: '',
    session_duration_min: '',
    training_preference: '',
    partner_training: false,
  });

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('training_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      if (data) {
        setFormData(prev => ({...prev, ...data}));
      }
    } catch (error) {
      console.error("Error fetching training preferences:", error);
      toast({ title: 'Error', description: 'No se pudieron cargar las preferencias de entreno.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleChange = (id, value) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('training_preferences').upsert({ ...formData, user_id: userId }, { onConflict: 'user_id' });
      if (error) throw error;
      
      if (onUpdate) onUpdate();
      else {
        toast({ title: 'Éxito', description: 'Preferencias de entreno guardadas correctamente.' });
      }
    } catch (error) {
      console.error("Error saving training preferences:", error);
      toast({ title: 'Error', description: `No se pudieron guardar las preferencias: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-[#F44C40]" />
      </div>
    );
  }

  return (
    <ProfileSectionCard title="Preferencias de Entrenamiento" icon={Dumbbell} color="red">
      <form onSubmit={handleSubmit} className="space-y-8">
        <FormBlock title="Información General" icon={Target} color="red">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormRow id="training_goal" label="Objetivo de Entrenamiento" value={formData.training_goal || ''} onChange={handleChange} />
                <FormRow id="training_preference" label="Preferencia (Fuerza, Hipertrofia...)" value={formData.training_preference || ''} onChange={handleChange} />
                <FormRow id="training_location" label="Lugar de Entrenamiento" value={formData.training_location || ''} onChange={handleChange} />
                <FormRow id="discomforts" label="Molestias o Lesiones" value={formData.discomforts || ''} onChange={handleChange} />
            </div>
            <div className="pt-2">
                <FormRow id="partner_training" label="¿Entrenas con compañero/a?" type="checkbox" value={formData.partner_training || false} onChange={handleChange} color="red"/>
            </div>
        </FormBlock>

        <FormBlock title="Frecuencia" icon={Repeat} color="red">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormRow id="sessions_per_week" label="Sesiones por Semana" type="number" value={formData.sessions_per_week || ''} onChange={handleChange} />
                <FormRow id="session_duration_min" label="Duración por Sesión (min)" type="number" value={formData.session_duration_min || ''} onChange={handleChange} />
            </div>
        </FormBlock>

        <Button type="submit" className="w-full text-lg font-semibold py-6 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 transition-all duration-300" disabled={isSubmitting}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar Preferencias de Entreno'}
        </Button>
      </form>
    </ProfileSectionCard>
  );
};

export default TrainingPreferencesForm;