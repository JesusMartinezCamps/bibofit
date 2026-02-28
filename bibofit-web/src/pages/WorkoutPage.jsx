import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Dumbbell, ArrowLeft, PlayCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const mockRoutines = [
  { id: 1, name: 'Tren Superior - Fuerza', description: 'Enfoque en pecho, hombros y tríceps.' },
  { id: 2, name: 'Pierna - Hipertrofia', description: 'Rutina completa para cuádriceps, isquios y gemelos.' },
  { id: 3, name: 'Cardio y Core', description: 'Sesión de alta intensidad para mejorar resistencia y fortalecer el abdomen.' },
];

const WorkoutPage = () => {
  const { date } = useParams();
  const { toast } = useToast();
  const formattedDate = date ? new Date(date).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : '';

  const handleStartRoutine = (routineName) => {
    toast({
      title: `¡A por ello! Empezando rutina: ${routineName}`,
      description: "🚧 Esta funcionalidad aún no está implementada—¡pero no te preocupes! ¡Puedes solicitarla en tu próximo prompt! 🚀",
    });
  };

  return (
    <>
      <Helmet>
        <title>{formattedDate ? `Plan de Entreno - ${formattedDate}` : 'Plan de Entreno'} - Gsus Martz</title>
        <meta name="description" content={`Tu rutina de entrenamiento para el día ${formattedDate}`} />
      </Helmet>

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link to="/dashboard" className="inline-flex items-center text-gray-400 hover:text-white mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al calendario
          </Link>
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-16 h-16 bg-[#F44C40] rounded-lg flex items-center justify-center">
              <Dumbbell className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">Plan de Entreno</h1>
              <p className="text-lg text-[#F44C40]">{formattedDate}</p>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {mockRoutines.map((routine, index) => (
            <motion.div
              key={routine.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-effect rounded-2xl p-6 flex flex-col justify-between card-hover"
            >
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{routine.name}</h2>
                <p className="text-gray-400 mb-6">{routine.description}</p>
              </div>
              <Button onClick={() => handleStartRoutine(routine.name)} variant="training" className="w-full">
                <PlayCircle className="mr-2 h-5 w-5" />
                Empezar rutina
              </Button>
            </motion.div>
          ))}
        </div>
      </main>
    </>
  );
};

export default WorkoutPage;