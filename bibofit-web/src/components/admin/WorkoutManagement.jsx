import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dumbbell, Plus, Edit, Trash2, Search, User, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const WorkoutManagement = () => {
  const [workouts, setWorkouts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadWorkouts = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('workouts').select('*');
      if (error) {
        toast({ title: "Error", description: "No se pudieron cargar los entrenamientos.", variant: "destructive" });
      } else {
        const formattedWorkouts = data.map(w => ({ ...w, userName: w.user_name, lastUpdated: w.last_updated, exerciseCount: w.exercise_count }));
        setWorkouts(formattedWorkouts);
      }
      setLoading(false);
    };
    loadWorkouts();
  }, [toast]);

  const filteredWorkouts = workouts.filter(workout =>
    workout.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (workout.userName && workout.userName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    workout.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addWorkout = () => {
    toast({
      title: "Crear entrenamiento",
      description: "🚧 Esta funcionalidad aún no está implementada—¡pero no te preocupes! ¡Puedes solicitarla en tu próximo prompt! 🚀"
    });
  };

  const editWorkout = (workoutId) => {
    toast({
      title: "Editar entrenamiento",
      description: "🚧 Esta funcionalidad aún no está implementada—¡pero no te preocupes! ¡Puedes solicitarla en tu próximo prompt! 🚀"
    });
  };

  const deleteWorkout = (workoutId) => {
    toast({
      title: "Eliminar entrenamiento",
      description: "🚧 Esta funcionalidad aún no está implementada—¡pero no te preocupes! ¡Puedes solicitarla en tu próximo prompt! 🚀"
    });
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Principiante': return 'bg-green-500 bg-opacity-20 text-green-300';
      case 'Intermedio': return 'bg-yellow-500 bg-opacity-20 text-yellow-300';
      case 'Avanzado': return 'bg-red-500 bg-opacity-20 text-red-300';
      default: return 'bg-gray-500 bg-opacity-20 text-gray-300';
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Fuerza': return 'bg-blue-500 bg-opacity-20 text-blue-300';
      case 'Cardio': return 'bg-orange-500 bg-opacity-20 text-orange-300';
      case 'Funcional': return 'bg-purple-500 bg-opacity-20 text-purple-300';
      default: return 'bg-gray-500 bg-opacity-20 text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col md:flex-row md:items-center justify-between"
      >
        <div className="flex items-center space-x-3 mb-4 md:mb-0">
          <Dumbbell className="w-8 h-8 text-[#5ebe7d]" />
          <h2 className="text-3xl font-bold text-white">Gestión de Entrenamientos</h2>
        </div>
        <Button onClick={addWorkout} className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Crear Entrenamiento
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="glass-effect rounded-2xl p-6"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar entrenamientos por nombre, cliente o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field w-full pl-10"
          />
        </div>
      </motion.div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Cargando entrenamientos...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredWorkouts.map((workout, index) => (
            <motion.div
              key={workout.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
              className="glass-effect rounded-2xl p-6 card-hover"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">{workout.name}</h3>
                  <div className="flex items-center space-x-2 text-gray-400 mb-2"><User className="w-4 h-4" /><span className="text-sm">{workout.userName}</span></div>
                  <div className="flex items-center space-x-2"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(workout.category)}`}>{workout.category}</span><span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(workout.difficulty)}`}>{workout.difficulty}</span></div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${workout.status === 'active' ? 'bg-green-500 bg-opacity-20 text-green-300' : 'bg-gray-500 bg-opacity-20 text-gray-300'}`}>{workout.status === 'active' ? 'Activo' : 'Inactivo'}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#1a1e23] rounded-lg p-3"><div className="flex items-center space-x-2"><Clock className="w-4 h-4 text-gray-400" /><div><p className="text-gray-400 text-xs">Duración</p><p className="text-white font-semibold">{workout.duration} min</p></div></div></div>
                <div className="bg-[#1a1e23] rounded-lg p-3"><div className="flex items-center space-x-2"><Dumbbell className="w-4 h-4 text-gray-400" /><div><p className="text-gray-400 text-xs">Ejercicios</p><p className="text-white font-semibold">{workout.exerciseCount}</p></div></div></div>
              </div>
              <div className="mb-4"><p className="text-gray-400 text-sm">Última actualización: {new Date(workout.lastUpdated).toLocaleDateString('es-ES')}</p></div>
              <div className="flex items-center space-x-2">
                <Button onClick={() => editWorkout(workout.id)} size="sm" className="btn-secondary flex-1"><Edit className="w-4 h-4 mr-2" />Editar</Button>
                <Button onClick={() => deleteWorkout(workout.id)} size="sm" variant="ghost" className="text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && filteredWorkouts.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="glass-effect rounded-2xl p-8 text-center"
        >
          <Dumbbell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No se encontraron entrenamientos</p>
        </motion.div>
      )}
    </div>
  );
};

export default WorkoutManagement;