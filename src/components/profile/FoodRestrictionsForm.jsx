import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, PlusCircle, X, Shield, HeartPulse } from 'lucide-react';
import SearchSelectionModal from '@/components/shared/SearchSelectionModal';

const FoodRestrictionsForm = ({ userId, onSaveStatusChange }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  
  const [allSensitivities, setAllSensitivities] = useState([]);
  const [allMedicalConditions, setAllMedicalConditions] = useState([]);
  const [selectedSensitivities, setSelectedSensitivities] = useState([]);
  const [selectedMedicalConditions, setSelectedMedicalConditions] = useState([]);

  // Modals State
  const [isSensitivityModalOpen, setIsSensitivityModalOpen] = useState(false);
  const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
  const [sensitivityLevel, setSensitivityLevel] = useState('Leve');

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const [sensRes, userSensRes, condRes, userCondRes] = await Promise.all([
            supabase.from('sensitivities').select('id, name'),
            supabase.from('user_sensitivities').select('sensitivity_id, sensitivitie_level').eq('user_id', userId),
            supabase.from('medical_conditions').select('id, name'),
            supabase.from('user_medical_conditions').select('condition_id').eq('user_id', userId)
        ]);

        if (sensRes.data) setAllSensitivities(sensRes.data);
        if (userSensRes.data) setSelectedSensitivities(userSensRes.data);
        if (condRes.data) setAllMedicalConditions(condRes.data);
        if (userCondRes.data) setSelectedMedicalConditions(userCondRes.data.map(c => c.condition_id));
      } catch (error) {
        console.error("Error fetching restrictions:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  const handleAddSensitivity = async (sensitivity) => {
    if (selectedSensitivities.some(s => s.sensitivity_id === sensitivity.id)) return;
    
    if (onSaveStatusChange) onSaveStatusChange('saving');
    try {
        const { error } = await supabase.from('user_sensitivities').insert({ user_id: userId, sensitivity_id: sensitivity.id, sensitivitie_level: sensitivityLevel });
        if (error) throw error;
        
        setSelectedSensitivities(prev => [...prev, { sensitivity_id: sensitivity.id, sensitivitie_level: sensitivityLevel }]);
        setIsSensitivityModalOpen(false);
        if (onSaveStatusChange) onSaveStatusChange('saved');
    } catch (e) {
        toast({ title: "Error", description: "No se pudo añadir la sensibilidad.", variant: "destructive" });
        if (onSaveStatusChange) onSaveStatusChange('error');
    }
  };

  const handleRemoveSensitivity = async (sensitivityId) => {
    if (onSaveStatusChange) onSaveStatusChange('saving');
    try {
        const { error } = await supabase.from('user_sensitivities').delete().eq('user_id', userId).eq('sensitivity_id', sensitivityId);
        if (error) throw error;
        
        setSelectedSensitivities(prev => prev.filter(s => s.sensitivity_id !== sensitivityId));
        if (onSaveStatusChange) onSaveStatusChange('saved');
    } catch (e) {
        toast({ title: "Error", description: "Error eliminando sensibilidad.", variant: "destructive" });
        if (onSaveStatusChange) onSaveStatusChange('error');
    }
  };

  const handleAddCondition = async (condition) => {
    if (selectedMedicalConditions.includes(condition.id)) return;

    if (onSaveStatusChange) onSaveStatusChange('saving');
    try {
        const { error } = await supabase.from('user_medical_conditions').insert({ user_id: userId, condition_id: condition.id });
        if (error) throw error;
        
        setSelectedMedicalConditions(prev => [...prev, condition.id]);
        setIsConditionModalOpen(false);
        if (onSaveStatusChange) onSaveStatusChange('saved');
    } catch (e) {
        toast({ title: "Error", description: "No se pudo añadir la condición.", variant: "destructive" });
        if (onSaveStatusChange) onSaveStatusChange('error');
    }
  };

  const handleRemoveCondition = async (conditionId) => {
    if (onSaveStatusChange) onSaveStatusChange('saving');
    try {
        const { error } = await supabase.from('user_medical_conditions').delete().eq('user_id', userId).eq('condition_id', conditionId);
        if (error) throw error;
        
        setSelectedMedicalConditions(prev => prev.filter(c => c !== conditionId));
        if (onSaveStatusChange) onSaveStatusChange('saved');
    } catch (e) {
        toast({ title: "Error", description: "Error eliminando condición.", variant: "destructive" });
        if (onSaveStatusChange) onSaveStatusChange('error');
    }
  };
  
  const availableSensitivities = useMemo(() => {
     return allSensitivities.filter(s => !selectedSensitivities.some(sel => sel.sensitivity_id === s.id));
  }, [allSensitivities, selectedSensitivities]);

  const availableConditions = useMemo(() => {
     return allMedicalConditions.filter(c => !selectedMedicalConditions.includes(c.id));
  }, [allMedicalConditions, selectedMedicalConditions]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-green-500" /></div>;

  return (
    <div className="space-y-6">
        <div className="p-4 rounded-lg border border-orange-500/30 bg-[#47330526]">
            <div className="flex items-center justify-between mb-4">
                 <h4 className="font-semibold text-orange-400 flex items-center gap-2"><Shield size={16}/> Sensibilidades</h4>
                 <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="border-orange-500/50 text-orange-400 bg-[hsl(36deg_63.96%_15.46%_/_0.65)] hover:bg-[hsl(36deg_63.96%_15.46%_/_0.58)] hover:text-gray-100" 
                    onClick={() => setIsSensitivityModalOpen(true)}
                 >
                    <PlusCircle className="w-4 h-4 mr-2" /> Añadir
                 </Button>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedSensitivities.length === 0 && <p className="text-gray-500 text-sm italic">No hay sensibilidades seleccionadas.</p>}
              {selectedSensitivities.map(s => {
                const details = allSensitivities.find(as => as.id === s.sensitivity_id);
                return details ? (
                    <Badge key={s.sensitivity_id} variant="destructive" className="bg-orange-600/20 border border-orange-500/30 text-orange-300">
                        {details.name} ({s.sensitivitie_level})
                        <button type="button" onClick={() => handleRemoveSensitivity(s.sensitivity_id)} className="ml-2 hover:text-white"><X size={14}/></button>
                    </Badge>
                ) : null;
              })}
            </div>
        </div>

        <div className="p-4 rounded-lg border border-red-500/30 bg-[#47050526]">
            <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-red-400 flex items-center gap-2"><HeartPulse size={16}/> Condiciones Médicas</h4>
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="border-red-500/50 text-red-400 bg-[hsl(0deg_60%_11.41%_/_0.65)] hover:bg-[hsl(0deg_60%_11.41%_/_0.58)] hover:text-gray-100" 
                    onClick={() => setIsConditionModalOpen(true)}
                >
                     <PlusCircle className="w-4 h-4 mr-2" /> Añadir
                </Button>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedMedicalConditions.length === 0 && <p className="text-gray-500 text-sm italic">No hay condiciones seleccionadas.</p>}
              {selectedMedicalConditions.map(cId => {
                const details = allMedicalConditions.find(amc => amc.id === cId);
                return details ? <Badge key={cId} variant="destructive" className="bg-red-600/20 border border-red-500/30 text-red-300">{details.name} <button type="button" onClick={() => handleRemoveCondition(cId)} className="ml-2 hover:text-white"><X size={14}/></button></Badge> : null;
              })}
            </div>
        </div>

      <SearchSelectionModal 
        open={isSensitivityModalOpen} 
        onOpenChange={setIsSensitivityModalOpen}
        title="Añadir Sensibilidad"
        searchPlaceholder="Buscar sensibilidad..."
        items={availableSensitivities}
        onSelect={handleAddSensitivity}
        headerContent={
            <div className="flex items-center gap-3 p-2 rounded bg-gray-800/50 border border-gray-700">
                <span className="text-sm text-gray-400 whitespace-nowrap">Nivel de sensibilidad:</span>
                <Select value={sensitivityLevel} onValueChange={setSensitivityLevel}>
                    <SelectTrigger className="h-8 w-32 bg-gray-700 border-gray-600 text-xs text-white">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Leve">Leve</SelectItem>
                        <SelectItem value="Moderado">Moderado</SelectItem>
                        <SelectItem value="Grave">Grave</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        }
      />

      <SearchSelectionModal 
        open={isConditionModalOpen} 
        onOpenChange={setIsConditionModalOpen}
        title="Añadir Condición Médica"
        searchPlaceholder="Buscar condición..."
        items={availableConditions}
        onSelect={handleAddCondition}
      />
    </div>
  );
};

export default FoodRestrictionsForm;