import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dumbbell, Plus, Clock, Target, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const WorkoutPanel = ({ selectedDate }) => {
  const [workout, setWorkout] = useState(null);
  const [completedExercises, setCompletedExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const loadWorkoutData = async () => {
      if (!user) return;
      setLoading(true);
      const dateKey = selectedDate.toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('workout_entries')
        .select('workout_plan, completed_exercises')
        .eq('user_id', user.id)
        .eq('date', dateKey)
        .single();

      if (data) {
        setWorkout(data.workout_plan);
        setCompletedExercises(data.completed_exercises || []);
      } else {
        setWorkout(null);
        setCompletedExercises([]);
      }
      setLoading(false);
    };

    loadWorkoutData();
  }, [selectedDate, user]);

  const toggleExerciseComplete = async (exerciseId) => {
    if (!user || !workout) return;
    const dateKey = selectedDate.toISOString().split('T')[0];
    let newCompleted;
    
    if (completedExercises.includes(exerciseId)) {
      newCompleted = completedExercises.filter(id => id !== exerciseId);
    } else {
      newCompleted = [...completedExercises, exerciseId];
      toast({ title: "¡Ejercicio completado!", description: "¡Excelente trabajo! Sigue así." });
    }
    
    setCompletedExercises(newCompleted);

    const { error } = await supabase
      .from('workout_entries')
      .upsert({ 
        user_id: user.id, 
        date: dateKey, 
        workout_plan: workout,
        completed_exercises: newCompleted 
      }, { onConflict: 'user_id, date' });

    if (error) {
      toast({ title: "Error", description: "No se pudo guardar el progreso.", variant: "destructive" });
      // Revert state on error
      setCompletedExercises(completedExercises);
    }
  };

  const addExercise = () => {
    toast({
      title: "Agregar ejercicio",
      description: "🚧 Esta funcionalidad aún no está implementada—¡pero no te preocupes! ¡Puedes solicitarla en tu próximo prompt! 🚀"
    });
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Cargando entrenamiento...</div>;
  }

  if (!workout) {
    return (
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="glass-effect rounded-2xl p-8 text-center">
          <Dumbbell className="w-16 h-16 text-[#5ebe7d] mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">No hay entrenamiento programado</h3>
          <p className="text-gray-400 mb-6">Para el {selectedDate.toLocaleDateString('es-ES')}</p>
          <Button onClick={addExercise} className="btn-primary"><Plus className="w-5 h-5 mr-2" />Crear Entrenamiento</Button>
        </motion.div>
      </div>
    );
  }

  const completionPercentage = workout.exercises.length > 0 ? (completedExercises.length / workout.exercises.length) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
        <div className="flex items-center justify-center space-x-3 mb-4"><Dumbbell className="w-8 h-8 text-[#5ebe7d]" /><h2 className="text-3xl font-bold text-white">Entrenamiento</h2></div>
        <p className="text-gray-400">{selectedDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="glass-effect rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">{workout.name}</h3>
            <div className="flex items-center space-x-4 text-gray-400"><div className="flex items-center space-x-1"><Clock className="w-4 h-4" /><span>{workout.duration} min</span></div><div className="flex items-center space-x-1"><Target className="w-4 h-4" /><span>{workout.difficulty}</span></div></div>
          </div>
          <div className="mt-4 md:mt-0">
            <div className="text-right"><p className="text-sm text-gray-400">Progreso</p><p className="text-2xl font-bold text-[#5ebe7d]">{Math.round(completionPercentage)}%</p></div>
            <div className="w-32 bg-gray-700 rounded-full h-2 mt-2"><div className="bg-[#5ebe7d] h-2 rounded-full transition-all duration-300" style={{ width: `${completionPercentage}%` }}></div></div>
          </div>
        </div>
      </motion.div>

      <div className="space-y-4">
        {workout.exercises.map((exercise, index) => (
          <motion.div key={exercise.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }} className={`glass-effect rounded-2xl p-6 transition-all duration-300 ${completedExercises.includes(exercise.id) ? 'bg-[#5ebe7d] bg-opacity-10 border border-[#5ebe7d] border-opacity-30' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3"><h4 className="text-xl font-semibold text-white">{exercise.name}</h4>{completedExercises.includes(exercise.id) && (<CheckCircle className="w-6 h-6 text-[#5ebe7d]" />)}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div className="bg-[#1a1e23] rounded-lg p-3"><p className="text-gray-400 text-sm">Series</p><p className="text-white font-semibold">{exercise.sets}</p></div>
                  <div className="bg-[#1a1e23] rounded-lg p-3"><p className="text-gray-400 text-sm">Reps</p><p className="text-white font-semibold">{exercise.reps}</p></div>
                  <div className="bg-[#1a1e23] rounded-lg p-3"><p className="text-gray-400 text-sm">Peso</p><p className="text-white font-semibold">{exercise.weight}</p></div>
                  <div className="bg-[#1a1e23] rounded-lg p-3"><p className="text-gray-400 text-sm">Descanso</p><p className="text-white font-semibold">{exercise.rest}</p></div>
                </div>
                {exercise.notes && (<div className="bg-[#1a1e23] rounded-lg p-3"><p className="text-gray-400 text-sm mb-1">Notas</p><p className="text-white text-sm">{exercise.notes}</p></div>)}
              </div>
              <Button onClick={() => toggleExerciseComplete(exercise.id)} className={`ml-4 ${completedExercises.includes(exercise.id) ? 'bg-[#5ebe7d] hover:bg-[#4a9960] text-white' : 'btn-secondary'}`}>{completedExercises.includes(exercise.id) ? 'Completado' : 'Marcar'}</Button>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }} className="text-center">
        <Button onClick={addExercise} className="btn-primary"><Plus className="w-5 h-5 mr-2" />Agregar Ejercicio</Button>
      </motion.div>

      {completionPercentage === 100 && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }} className="glass-effect rounded-2xl p-6 text-center bg-[#5ebe7d] bg-opacity-20">
          <h3 className="text-2xl font-bold text-[#5ebe7d] mb-2">¡Entrenamiento Completado!</h3>
          <p className="text-white">¡Excelente trabajo! Te has superado una vez más. 💪</p>
        </motion.div>
      )}
    </div>
  );
};

export default WorkoutPanel;