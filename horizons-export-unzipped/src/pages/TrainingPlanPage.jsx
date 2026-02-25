import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Dumbbell, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import SwipeIndicator from '@/components/shared/SwipeIndicator';

const TrainingPlanPage = () => {
  const navigate = useNavigate();
  const { handlers: swipeHandlers, isSwiping, swipeOffset, swipeDirection } = useSwipeGesture({
    onSwipeLeft: () => {
      navigate('/dashboard');
    }
  });

  return (
    <>
      <Helmet>
        <title>Plan de Entreno - Gsus Martz</title>
        <meta name="description" content="Tu plan de entrenamiento completo." />
      </Helmet>

      <main className="w-full px-4 py-8 touch-pan-y" {...swipeHandlers}>
        <SwipeIndicator isSwiping={isSwiping && swipeDirection === 'left'} offset={swipeOffset} variant="calendar-edge-right" />
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Button asChild variant="ghost" className="mb-6 text-gray-400 hover:text-white">
            <Link to="/plan">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a El Plan
            </Link>
          </Button>
          
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-[#F44C40]/20 rounded-lg flex items-center justify-center border border-[#F44C40]/30">
                <Dumbbell className="w-8 h-8 text-[#F44C40]" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white">Plan de Entreno</h1>
                <p className="text-lg text-gray-400">Tu guía de entrenamiento completa.</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Aquí irá el contenido del plan de entreno */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center py-20 glass-effect rounded-2xl"
        >
          <h2 className="text-2xl font-bold text-white">Próximamente...</h2>
          <p className="text-gray-400 mt-2">Aquí verás tu plan de entrenamiento semanal detallado.</p>
        </motion.div>

      </main>
    </>
  );
};

export default TrainingPlanPage;
