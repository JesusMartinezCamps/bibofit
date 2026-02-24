import React, { useState, useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, History, FileType, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const DietObjectiveStep = ({ onNext, isLoading }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    diet_goal_id: '',     
    diet_history: '',
    diet_type_id: ''      
  });
  const [dietTypes, setDietTypes] = useState([]);
  const [dietGoals, setDietGoals] = useState([]);
  const [errors, setErrors] = useState({});
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const [typesRes, goalsRes, preferencesRes] = await Promise.all([
          supabase.from('diet_types').select('id, name').order('name'),
          supabase.from('diet_goals').select('id, name, description').order('name'),
          supabase.from('diet_preferences').select('diet_goal_id, diet_type_id, diet_history').eq('user_id', user.id).maybeSingle()
        ]);

        if (!mounted) return;

        if (typesRes.data) setDietTypes(typesRes.data);
        if (goalsRes.data) setDietGoals(goalsRes.data);

        const pref = preferencesRes.data;
        if (pref) {
          setFormData({
            diet_goal_id: pref.diet_goal_id ? String(pref.diet_goal_id) : '',
            diet_history: pref.diet_history ?? '',
            diet_type_id: pref.diet_type_id != null ? String(pref.diet_type_id) : ''
          });
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        if (mounted) setLoadingData(false);
      }
    };
    if (user?.id) fetchData();
    return () => { mounted = false; };
  }, [user?.id]);

  const validate = () => {
    const newErrors = {};
    if (!formData.diet_goal_id) newErrors.diet_goal_id = 'El objetivo es obligatorio';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const selectedGoalDescription = useMemo(() => {
    if (!formData.diet_goal_id) return '';
    const goal = dietGoals.find(g => String(g.id) === String(formData.diet_goal_id));
    return goal ? goal.description : '';
  }, [formData.diet_goal_id, dietGoals]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onNext({
        diet_goal_id: formData.diet_goal_id,
        diet_history: formData.diet_history,
        diet_type_id: formData.diet_type_id ? Number(formData.diet_type_id) : null
      });
    }
  };

  if (loadingData) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-green-500" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 space-y-6 overflow-y-auto pr-1">

        {/* OBJETIVO PRINCIPAL */}
        <div className="space-y-3">
          <Label htmlFor="diet_goal_id" className="text-gray-300 flex items-center gap-2">
            <Target className="w-4 h-4 text-green-500" /> Objetivo Principal
          </Label>
          <Select
            value={formData.diet_goal_id}
            onValueChange={(v) => {
              setFormData(prev => ({ ...prev, diet_goal_id: v }));
              setErrors(prev => ({ ...prev, diet_goal_id: undefined }));
            }}
          >
            <SelectTrigger id="diet_goal_id" className="bg-gray-800/50 border-gray-700 text-white h-12 w-full">
              <SelectValue placeholder="Selecciona un objetivo..." />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white z-[9999]">
              {dietGoals.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedGoalDescription && (
            <p className="text-xs text-gray-400 italic">{selectedGoalDescription}</p>
          )}
          {errors.diet_goal_id && (
            <p className="text-red-400 text-sm">{errors.diet_goal_id}</p>
          )}
        </div>

        {/* TIPO DE DIETA */}
        <div className="space-y-3">
          <Label htmlFor="diet_type" className="text-gray-300 flex items-center gap-2">
            <FileType className="w-4 h-4 text-purple-500" /> Tipo de Dieta Preferida
          </Label>
          <Select
            value={formData.diet_type_id}
            onValueChange={(v) => setFormData(prev => ({ ...prev, diet_type_id: v }))}
          >
            <SelectTrigger id="diet_type" className="bg-gray-800/50 border-gray-700 text-white h-12 w-full">
              <SelectValue placeholder="Selecciona (Opcional)" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white z-[9999]">
              {dietTypes.map((type) => (
                <SelectItem key={type.id} value={String(type.id)}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* HISTORIAL */}
        <div className="space-y-3">
          <Label htmlFor="history" className="text-gray-300 flex items-center gap-2">
            <History className="w-4 h-4 text-blue-500" /> Historial (Opcional)
          </Label>
          <Textarea
            id="history"
            value={formData.diet_history}
            onChange={(e) => setFormData(prev => ({ ...prev, diet_history: e.target.value }))}
            className="bg-gray-800/50 border-gray-700 text-white resize-none min-h-[120px]"
            placeholder="Cuéntanos brevemente tu experiencia con dietas anteriores..."
          />
        </div>

      </div>

      <div className="pt-6 mt-auto shrink-0">
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Guardando...
            </>
          ) : (
            'Siguiente'
          )}
        </Button>
      </div>
    </form>
  );
};

export default DietObjectiveStep;