import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, X, Activity } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Link } from 'react-router-dom';
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ExerciseCard = ({ exercise, onSelect, isSelected }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      onClick={() => onSelect(exercise)}
      className={`bg-[#282d34] p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
        isSelected ? 'border-train-red ring-1 ring-train-red' : 'border-gray-700 hover:border-train-red'
      }`}
    >
      <h3 className="text-md font-bold text-white truncate">{exercise.name}</h3>
      <p className="text-xs text-gray-400 truncate mt-1">{exercise.technique || 'Sin descripción'}</p>
    </motion.div>
  );
};

const CustomCheckboxGrid = ({ label, options, selected, onChange, className, isSingleSelection = false }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <div className="rounded-md border border-slate-800 p-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 bg-slate-950 max-h-48 overflow-y-auto">
      {options.map((option) => (
        <div key={option.value} className="flex items-center space-x-2">
          <Checkbox
            id={`${label}-${option.value}`}
            checked={selected.includes(option.value)}
            onCheckedChange={(checked) => {
              if (isSingleSelection) {
                onChange(checked ? [option.value] : []);
              } else {
                const newSelected = checked
                  ? [...selected, option.value]
                  : selected.filter((item) => item !== option.value);
                onChange(newSelected);
              }
            }}
            className={className}
          />
          <label htmlFor={`${label}-${option.value}`} className="text-sm font-medium leading-none cursor-pointer select-none">{option.label}</label>
        </div>
      ))}
    </div>
  </div>
);

const CreateExercisePage = () => {
  const { toast } = useToast();
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
  const [formData, setFormData] = useState({ name: '', technique: '', unilateral: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullExerciseData, setFullExerciseData] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [allMuscles, setAllMuscles] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [movementPatterns, setMovementPatterns] = useState([]);
  
  const [selectedPattern, setSelectedPattern] = useState('');
  const [selectedMuscles, setSelectedMuscles] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState([]);

  const fetchAllData = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const [
        { data: exercises, error: exError },
        { data: muscles, error: muError },
        { data: equipment, error: eqError },
      ] = await Promise.all([
        supabase.from('exercises').select('*').order('name', { ascending: true }),
        supabase.from('muscles').select('id, name, patron_movimiento'),
        supabase.from('equipment').select('id, name'),
      ]);

      if (exError || muError || eqError) throw new Error('Error al cargar datos');

      setFullExerciseData(exercises);
      setAllMuscles(muscles.map(m => ({ ...m, value: m.id, label: m.name })));
      setAllEquipment(equipment.map(e => ({ value: e.id, label: e.name })));
      
      const patterns = [...new Set(muscles.map(m => m.patron_movimiento).filter(Boolean))];
      setMovementPatterns(patterns.sort());

    } catch (error) {
      toast({ title: "Error", description: "No se pudo cargar la información de base.", variant: "destructive" });
    } finally {
      setIsLoadingList(false);
    }
  }, [toast]);
  
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const filteredMuscles = useMemo(() => {
    if (!selectedPattern) return allMuscles;
    return allMuscles.filter(m => m.patron_movimiento === selectedPattern);
  }, [selectedPattern, allMuscles]);

  const filteredExerciseList = useMemo(() => {
    if (!searchTerm) return fullExerciseData;
    const lowercasedFilter = searchTerm.toLowerCase();
    return fullExerciseData.filter(ex => ex.name.toLowerCase().includes(lowercasedFilter));
  }, [searchTerm, fullExerciseData]);

  const resetForm = useCallback(() => {
    setSelectedExerciseId(null);
    setFormData({ name: '', technique: '', unilateral: false });
    setSelectedPattern('');
    setSelectedMuscles([]);
    setSelectedEquipment([]);
  }, []);

  const handleSelectExercise = useCallback(async (exercise) => {
    if (selectedExerciseId === exercise.id) {
        resetForm();
        return;
    }
    setSelectedExerciseId(exercise.id);
    setFormData({
      name: exercise.name || '',
      technique: exercise.technique || '',
      unilateral: exercise.unilateral || false,
    });
    setSelectedEquipment(exercise.equipment_id ? [exercise.equipment_id] : []);

    const { data: muscleData, error } = await supabase.from('exercise_muscles').select('muscle_id').eq('exercise_id', exercise.id);
    if (error) {
        toast({ title: "Error", description: "No se pudieron cargar los músculos del ejercicio.", variant: "destructive" });
        setSelectedMuscles([]);
    } else {
        setSelectedMuscles(muscleData.map(m => m.muscle_id));
    }
    setSelectedPattern(''); // Reset pattern filter on selection
  }, [selectedExerciseId, resetForm, toast]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast({ title: "Error", description: "El nombre del ejercicio es obligatorio.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    const exercisePayload = { 
      name: formData.name, 
      technique: formData.technique,
      unilateral: formData.unilateral,
      equipment_id: selectedEquipment.length > 0 ? selectedEquipment[0] : null,
    };
    
    let exerciseId = selectedExerciseId;

    if (selectedExerciseId) {
      const { error } = await supabase.from('exercises').update(exercisePayload).eq('id', selectedExerciseId);
      if (error) { toast({ title: "Error", description: `Error al actualizar: ${error.message}`, variant: "destructive" }); setIsSubmitting(false); return; }
    } else {
      const { data, error } = await supabase.from('exercises').insert(exercisePayload).select('id').single();
      if (error) { toast({ title: "Error", description: `Error al crear: ${error.message}`, variant: "destructive" }); setIsSubmitting(false); return; }
      exerciseId = data.id;
    }

    await supabase.from('exercise_muscles').delete().eq('exercise_id', exerciseId);
    if (selectedMuscles.length > 0) {
        const muscleInserts = selectedMuscles.map(muscle_id => ({ exercise_id: exerciseId, muscle_id }));
        const { error: muscleError } = await supabase.from('exercise_muscles').insert(muscleInserts);
        if (muscleError) {
            toast({ title: "Error Parcial", description: `Ejercicio guardado, pero falló la asociación de músculos.`, variant: "destructive" });
        }
    }
    
    toast({ title: "Éxito", description: `Ejercicio ${selectedExerciseId ? 'actualizado' : 'creado'} correctamente.` });
    resetForm();
    await fetchAllData();
    setIsSubmitting(false);
  };
  
  const breadcrumbItems = [
    { label: 'Gestión de Contenidos', href: '/admin-panel/content/training' },
    { label: 'Entrenamiento', href: '/admin-panel/content/training' },
    { label: 'Crear Ejercicio' },
  ];

  return (
    <>
      <Helmet><title>Gestión de Ejercicios - Gsus Martz</title><meta name="description" content="Crear y editar ejercicios." /></Helmet>
      <main className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Breadcrumbs items={breadcrumbItems} />
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-2">
                    <Card className="bg-[#1a1e23] border-gray-700 text-white h-full flex flex-col">
                        <CardHeader>
                            <CardTitle>Ejercicios Existentes</CardTitle>
                            <CardDescription>Selecciona un ejercicio para editarlo o búscalo.</CardDescription>
                            <div className="relative mt-2">
                                <Input 
                                    placeholder="Buscar por nombre..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="input-field pr-10"
                                />
                                {searchTerm && (
                                    <button type="button" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors" aria-label="Limpiar búsqueda"><X className="h-4 w-4" /></button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-grow overflow-hidden">
                            <div className="h-full overflow-y-auto space-y-3 pr-2">
                                {isLoadingList ? (
                                    <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-train-red" /></div>
                                ) : filteredExerciseList.length > 0 ? (
                                    filteredExerciseList.map(ex => <ExerciseCard key={ex.id} exercise={ex} onSelect={handleSelectExercise} isSelected={selectedExerciseId === ex.id} />)
                                ) : (
                                    <p className="text-gray-500 text-center pt-10">No se encontraron ejercicios.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-3">
                    <Card className="bg-[#1a1e23] border-gray-700 text-white">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>{selectedExerciseId ? 'Editar Ejercicio' : 'Crear Nuevo Ejercicio'}</CardTitle>
                                    <CardDescription>{selectedExerciseId ? 'Modifica los detalles.' : 'Añade un nuevo ejercicio.'}</CardDescription>
                                </div>
                                <Button asChild variant="outline" className="border-train-red text-train-red hover:bg-train-red/10 hover:text-train-red">
                                    <Link to="/admin/create-routine"><Activity className="mr-2 h-4 w-4"/>Ir a Crear Rutina</Link>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nombre del Ejercicio</Label>
                                    <Input id="name" name="name" value={formData.name} onChange={handleChange} className="input-field" required />
                                </div>
                                <div className="flex items-end pb-2 space-x-2">
                                    <Checkbox id="unilateral" name="unilateral" checked={formData.unilateral} onCheckedChange={(checked) => setFormData(f => ({...f, unilateral: checked}))} className="data-[state=checked]:bg-train-red data-[state=checked]:border-train-red" />
                                    <Label htmlFor="unilateral" className="cursor-pointer">Ejercicio Unilateral</Label>
                                </div>
                           </div>
                           <div className="space-y-2">
                              <Label htmlFor="technique">Técnica / Descripción</Label>
                              <textarea id="technique" name="technique" value={formData.technique} onChange={handleChange} className="input-field w-full min-h-[100px]"></textarea>
                           </div>
                           <div className="space-y-2">
                                <Label htmlFor="movement_pattern">Patrón de Movimiento</Label>
                                <Select value={selectedPattern} onValueChange={(value) => setSelectedPattern(value)}>
                                    <SelectTrigger id="movement_pattern" className="input-field"><SelectValue placeholder="Filtrar músculos por patrón..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Todos los patrones</SelectItem>
                                        {movementPatterns.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                           </div>
                           <CustomCheckboxGrid 
                                label="Músculos Implicados"
                                options={filteredMuscles}
                                selected={selectedMuscles}
                                onChange={setSelectedMuscles}
                                className="data-[state=checked]:bg-train-red data-[state=checked]:border-train-red"
                           />
                           <CustomCheckboxGrid 
                                label="Equipamiento (seleccionar uno)"
                                options={allEquipment}
                                selected={selectedEquipment}
                                onChange={(newSelection) => setSelectedEquipment(newSelection)}
                                className="data-[state=checked]:bg-train-red data-[state=checked]:border-train-red"
                                isSingleSelection={true}
                           />
                            <Button type="submit" className="w-full bg-train-red hover:bg-train-red/80 text-white" disabled={isSubmitting}>
                                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : (selectedExerciseId ? 'Actualizar Ejercicio' : 'Crear Ejercicio')}
                            </Button>
                        </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </motion.div>
      </main>
    </>
  );
};

export default CreateExercisePage;