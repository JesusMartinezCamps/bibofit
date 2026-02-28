import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, MessageSquare } from 'lucide-react';
import DayMealSelect from '@/components/ui/day-meal-select';

const AssignRecipeDialog = ({ recipe, open, onOpenChange, onAssigned, preselectedClientId, preselectedMealId }) => {
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [dietPlans, setDietPlans] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('null');
  const [dayMealId, setDayMealId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [mealPreferenceNote, setMealPreferenceNote] = useState('');

  useEffect(() => {
    if (open) {
      const fetchClients = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .eq('rol', 'client')
          .order('full_name');
        if (error) {
          toast({ title: 'Error', description: 'No se pudieron cargar los clientes.', variant: 'destructive' });
        } else {
          setClients(data);
          if (preselectedClientId) {
            setSelectedClientId(preselectedClientId);
          }
        }
      };
      fetchClients();
      if (preselectedMealId) {
        setDayMealId(preselectedMealId);
      }
    } else {
      setSelectedClientId('');
      setSelectedPlanId('');
      setDayOfWeek('null');
      setDayMealId('');
      setWarnings([]);
      setMealPreferenceNote('');
      setDietPlans([]);
    }
  }, [open, toast, preselectedClientId, preselectedMealId]);
  
  useEffect(() => {
    if (selectedClientId) {
      const fetchDietPlans = async () => {
        const { data, error } = await supabase
          .from('diet_plans')
          .select('id, name')
          .eq('user_id', selectedClientId)
          .order('start_date', { ascending: false });
        if (error) {
          toast({ title: 'Error', description: 'No se pudieron cargar los planes del cliente.', variant: 'destructive' });
        } else {
          setDietPlans(data);
          if (data.length > 0) {
            setSelectedPlanId(data[0].id.toString());
          } else {
            setSelectedPlanId('');
          }
        }
      };
      fetchDietPlans();
    } else {
      setDietPlans([]);
      setSelectedPlanId('');
    }
  }, [selectedClientId, toast]);


  useEffect(() => {
    if (!selectedClientId || !recipe?.id) {
      setWarnings([]);
      return;
    }

    const checkSensitivities = async () => {
      const { data: userSensitivities, error: userSensitivitiesError } = await supabase
        .from('user_sensitivities')
        .select('sensitivity_id')
        .eq('user_id', selectedClientId);

      if (userSensitivitiesError) return;
      const userSensitivityIds = userSensitivities.map(a => a.sensitivity_id);

      const { data: recipeSensitivities, error: recipeSensitivitiesError } = await supabase
        .from('recipe_sensitivities')
        .select('sensitivities(id, name)')
        .eq('recipe_id', recipe.id);
      
      if (recipeSensitivitiesError) return;
      
      const conflicts = recipeSensitivities.filter(ra => userSensitivityIds.includes(ra.sensitivities.id));
      
      if (conflicts.length > 0) {
        setWarnings([`El cliente tiene sensibilidad a: ${conflicts.map(c => c.sensitivities.name).join(', ')}.`]);
      } else {
        setWarnings([]);
      }
    };

    checkSensitivities();
  }, [selectedClientId, recipe, toast]);

  useEffect(() => {
    if (selectedClientId && dayMealId) {
      const fetchMealPreference = async () => {
        const { data, error } = await supabase
          .from('user_day_meals')
          .select('preferences')
          .eq('user_id', selectedClientId)
          .eq('day_meal_id', dayMealId)
          .single();
        
        if (!error && data?.preferences) {
          setMealPreferenceNote(data.preferences);
        } else {
          setMealPreferenceNote('');
        }
      };
      fetchMealPreference();
    } else {
      setMealPreferenceNote('');
    }
  }, [selectedClientId, dayMealId]);

  const handleAssign = async () => {
    if (!selectedClientId || !selectedPlanId || !dayMealId) {
      toast({ title: 'Campos requeridos', description: 'Por favor, selecciona cliente, plan y comida.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const { data: newDietPlanRecipe, error: insertError } = await supabase
        .from('diet_plan_recipes')
        .insert({
          diet_plan_id: parseInt(selectedPlanId),
          recipe_id: recipe.id,
          day_of_week: dayOfWeek !== 'null' ? parseInt(dayOfWeek) : null,
          day_meal_id: parseInt(dayMealId),
          is_customized: false,
        })
        .select('*, profile:diet_plan_id(profile:user_id(full_name))')
        .single();

      if (insertError) throw insertError;

      const client = clients.find(c => c.user_id === selectedClientId);
      toast({ title: 'Éxito', description: `Receta "${recipe.name}" asignada a ${client?.full_name}.` });
      if (onAssigned) onAssigned({ ...newDietPlanRecipe, user_id: selectedClientId });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Error', description: `No se pudo asignar la receta: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const dayOptions = [
    { value: 'null', label: 'Sin día específico (plantilla)' },
    { value: '1', label: 'Lunes' },
    { value: '2', label: 'Martes' },
    { value: '3', label: 'Miércoles' },
    { value: '4', label: 'Jueves' },
    { value: '5', label: 'Viernes' },
    { value: '6', label: 'Sábado' },
    { value: '7', label: 'Domingo' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1e23] border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle>Asignar Receta: {recipe?.name}</DialogTitle>
          <DialogDescription>Asigna esta plantilla de receta a un plan de dieta de un cliente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="input-field"><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
            <SelectContent>{clients.map(c => <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedPlanId} onValueChange={setSelectedPlanId} disabled={!selectedClientId || dietPlans.length === 0}>
            <SelectTrigger className="input-field"><SelectValue placeholder={dietPlans.length === 0 && selectedClientId ? "Este cliente no tiene planes" : "Seleccionar plan de dieta..."} /></SelectTrigger>
            <SelectContent>{dietPlans.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <DayMealSelect userId={selectedClientId} onValueChange={setDayMealId} value={dayMealId} />
          <Select onValueChange={setDayOfWeek} value={dayOfWeek} defaultValue="null">
            <SelectTrigger className="input-field"><SelectValue placeholder="Seleccionar día de la semana..." /></SelectTrigger>
            <SelectContent>{dayOptions.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
          </Select>
          
          {mealPreferenceNote && (
            <div className="p-3 bg-blue-900/30 border border-blue-500/50 rounded-md text-blue-300 text-sm space-y-1">
              <div className="flex items-center font-semibold"><MessageSquare className="w-4 h-4 mr-2" /> Preferencia del cliente</div>
              <p>{mealPreferenceNote}</p>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-md text-orange-400 text-sm space-y-1">
              <div className="flex items-center font-semibold"><AlertTriangle className="w-4 h-4 mr-2" /> Advertencia</div>
              {warnings.map((w, i) => <p key={i}>{w}</p>)}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAssign} disabled={isLoading} className="bg-[#983F5F] hover:bg-[#783550]">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Asignar Receta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignRecipeDialog;