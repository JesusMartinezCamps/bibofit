import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Loader2, X, PlusCircle, Activity } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from 'react-router-dom';

const ExerciseCard = ({ exercise, onSelect, isSelected }) => (
    <div 
      onClick={() => onSelect(exercise.id)}
      className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors duration-200 ${isSelected ? 'bg-train-red/20' : 'hover:bg-slate-800'}`}
    >
      <Checkbox checked={isSelected} id={`ex-check-${exercise.id}`} readOnly className="border-train-red data-[state=checked]:bg-train-red data-[state=checked]:text-white" />
      <label htmlFor={`ex-check-${exercise.id}`} className="text-sm font-medium text-white cursor-pointer">{exercise.name}</label>
    </div>
);

const RoutineCard = ({ routine, onSelect, isSelected }) => (
    <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        onClick={() => onSelect(routine)}
        className={`bg-[#282d34] p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
            isSelected ? 'border-train-red ring-1 ring-train-red' : 'border-gray-700 hover:border-train-red'
        }`}
    >
        <h3 className="text-md font-bold text-white truncate">{routine.name}</h3>
    </motion.div>
);

const CreateRoutinePage = () => {
    const { toast } = useToast();
    const [selectedRoutineId, setSelectedRoutineId] = useState(null);
    const [formData, setFormData] = useState({ name: '' });
    const [selectedExercises, setSelectedExercises] = useState([]);
    const [allExercises, setAllExercises] = useState([]);
    const [allRoutines, setAllRoutines] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [{ data: exercises, error: exError }, { data: routines, error: roError }] = await Promise.all([
                supabase.from('exercises').select('id, name').order('name', { ascending: true }),
                supabase.from('routines').select('*').order('name', { ascending: true })
            ]);
            if (exError || roError) throw exError || roError;

            setAllExercises(exercises);
            setAllRoutines(routines);
        } catch (error) {
            toast({ title: "Error", description: "No se pudo cargar la información.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleExerciseToggle = useCallback((exerciseId) => {
        setSelectedExercises(prev =>
            prev.includes(exerciseId)
                ? prev.filter(id => id !== exerciseId)
                : [...prev, exerciseId]
        );
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        toast({ title: "En desarrollo", description: "🚧 La creación y edición de rutinas aún no está implementada. ¡Puedes solicitarla en tu próximo prompt! 🚀" });
    };

    const resetForm = useCallback(() => {
        setSelectedRoutineId(null);
        setFormData({ name: '' });
        setSelectedExercises([]);
    }, []);

    const handleSelectRoutine = useCallback((routine) => {
        if (selectedRoutineId === routine.id) {
            resetForm();
            return;
        }
        setSelectedRoutineId(routine.id);
        setFormData({ name: routine.name });
        toast({ title: "En desarrollo", description: "🚧 La carga de ejercicios para una rutina aún no está implementada." });
    }, [selectedRoutineId, resetForm, toast]);

    const filteredRoutines = useMemo(() => {
        if (!searchTerm) return allRoutines;
        return allRoutines.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, allRoutines]);
    
    const breadcrumbItems = [
        { label: 'Gestión de Contenidos', href: '/admin-panel/content/training' },
        { label: 'Entrenamiento', href: '/admin-panel/content/training' },
        { label: 'Crear Rutina' },
    ];

    return (
        <>
            <Helmet><title>Gestión de Rutinas</title><meta name="description" content="Crear y editar rutinas de entrenamiento." /></Helmet>
            <main className="container mx-auto px-4 py-8">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <Breadcrumbs items={breadcrumbItems} />
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                        <div className="lg:col-span-2">
                            <Card className="bg-[#1a1e23] border-gray-700 text-white h-full flex flex-col">
                                <CardHeader>
                                    <CardTitle>Rutinas Existentes</CardTitle>
                                    <CardDescription>Selecciona una rutina para editarla.</CardDescription>
                                    <div className="relative mt-2">
                                        <Input placeholder="Buscar rutina por nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-field pr-10" />
                                        {searchTerm && <button type="button" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"><X className="h-4 w-4" /></button>}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow overflow-hidden">
                                    <div className="h-full overflow-y-auto space-y-3 pr-2">
                                        {isLoading ? <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-train-red" /></div> : filteredRoutines.length > 0 ? (
                                            filteredRoutines.map(r => <RoutineCard key={r.id} routine={r} onSelect={handleSelectRoutine} isSelected={selectedRoutineId === r.id} />)
                                        ) : <p className="text-gray-500 text-center pt-10">No se encontraron rutinas.</p>}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="lg:col-span-3">
                            <Card className="bg-[#1a1e23] border-gray-700 text-white">
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle>{selectedRoutineId ? 'Editar Rutina' : 'Crear Nueva Rutina'}</CardTitle>
                                            <CardDescription>{selectedRoutineId ? 'Modifica los detalles.' : 'Agrupa ejercicios para crear una rutina.'}</CardDescription>
                                        </div>
                                        <Button asChild variant="outline" className="border-train-red text-train-red hover:bg-train-red/10 hover:text-train-red">
                                            <Link to="/admin/create-exercise"><PlusCircle className="mr-2 h-4 w-4"/>Ir a Crear Ejercicio</Link>
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="routineName">Nombre de la Rutina</Label>
                                            <Input id="routineName" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Ejercicios</Label>
                                            <div className="max-h-80 overflow-y-auto space-y-2 p-3 bg-slate-950/50 rounded-md border border-slate-800">
                                                {isLoading ? <div className="flex justify-center items-center h-40"><Loader2 className="h-6 w-6 animate-spin text-train-red" /></div> : allExercises.map(ex => (
                                                    <ExerciseCard key={ex.id} exercise={ex} onSelect={handleExerciseToggle} isSelected={selectedExercises.includes(ex.id)} />
                                                ))}
                                            </div>
                                        </div>
                                        <Button type="submit" className="w-full bg-train-red hover:bg-train-red/80 text-white" disabled={isSubmitting}>
                                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : (selectedRoutineId ? 'Actualizar Rutina' : 'Crear Rutina')}
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

export default CreateRoutinePage;