import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, SlidersHorizontal, ChevronLeft, CheckCircle, Search, Calendar, ShoppingCart, ListTodo, Apple, Wand2, Sparkles, ArrowRightLeft } from 'lucide-react';
import { useQuickStartGuide } from '@/contexts/QuickStartGuideContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const steps = [
  {
    title: '¡Bienvenido a Bibofit!',
    subtitle: 'Una guía rápida para que domines la app',
    description: 'Recuerda: Siempre puedes volver a esta guía desde tu Perfil.',
    icon: Sparkles,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    isCover: true
  },
  {
    title: 'Tu Calendario',
    description: 'Desde aquí puedes acceder a tu Plan de dieta, además de ver un histórico de tus Registros de Peso y de tu tus comidas Marcadas como Comidas',
    icon: ListTodo,
    color: 'text-green-400',
    bg: 'bg-green-400/10'
  },
  {
    title: 'Gestos Rápidos',
    description: 'Desliza en el Dashboard: a la izquierda para abrir tu Plan de Dieta y a la derecha para abrir tu Plan de Entreno. Desde los planes, puedes deslizar para volver rápidamente al Dashboard.',
    icon: ArrowRightLeft,
    color: 'text-fuchsia-400',
    bg: 'bg-fuchsia-400/10'
  },
  {
    title: 'Crea nuevas variantes',
    description: 'Puedes personalizar a tu gusto las recetas de Bibofit. La dieta que no se disfruta es imposible de seguir',
    icon: SlidersHorizontal,
    color: 'text-orange-400',
    bg: 'bg-orange-400/10'
  },
  {
    title: 'Búsqueda Inteligente',
    description: 'Para cada momento de comida, encontrarás un Buscador Inteligente que te permite filtrar por nombre, alimento, dificultad de receta...',
    icon: Search,
    color: 'text-teal-400',
    bg: 'bg-teal-400/10'
  },
  {
    title: 'Marcar como Comida',
    description: 'Cuando elijas qué receta quieres comer, usa el botón "Marcar como Comida" para llevar un registro de tu progreso diario y mantener tu adherencia al plan.',
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10'
  },  
  {
    title: 'Planificación Semanal',
    description: 'Usa la vista semanal para organizar tus comidas de los próximos días.',
    icon: Calendar,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10'
  },
  {
    title: 'Lista de la Compra',
    description: 'Generada automáticamente basada en tu menú semanal. Añade artículos extras a tu lista de la compra privada. Perfecta para esos productos que no están en tu dieta pero necesitas comprar.',
    icon: ShoppingCart,
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10'
  },
  {
    title: 'Lista de la Compra Planificada',
    description: 'Generadada automáticamente en función de tus Recetas Planificadas. Calcula automáticamente las cantidades para hacerte la vida más fácil en el supermercado',
    icon: ListTodo,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10'
  },
  {
    title: 'Picoteo y Equivalencias',
    description: '¿Tienes hambre entre horas? Bibofit sabe que sí. Usa el botón "Picoteo". Así podrás usar el botón mágico de Equivalencia ajustará el resto de tu día para cuadrar tus macros.',
    icon: Wand2,
    color: 'text-rose-400',
    bg: 'bg-rose-400/10'
  },
  {
    title: 'Comidas Libres',
    description: '¿Tienes recetas que te encantan y las quieres añadir como "Comidas Libres"? Añade tus propias creaciones o elige de las recetas de la app, también tendrás disponible el botón mágico de Equivalencia para que las proporciones cubran tus macros.',
    icon: Apple,
    color: 'text-orange-400',
    bg: 'bg-orange-400/10'
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 }
  }
};

const QuickStartGuideModal = () => {
  const { isOpen, currentStep, nextStep, prevStep, completeGuide, closeGuide } = useQuickStartGuide();

  if (!isOpen) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeGuide}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-[#1a1e23] to-[#16191d] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800/50">
            <span className="text-sm font-medium text-gray-400">
              Guía Rápida • Paso {currentStep + 1} de {steps.length}
            </span>
            <button
              onClick={closeGuide}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1 bg-gray-800">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 to-green-400"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Content */}
          <div className="p-8 flex flex-col items-center text-center space-y-6 min-h-[300px] justify-center">
            <AnimatePresence mode="wait">
              {step.isCover ? (
                <motion.div
                  key="cover"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                  className="flex flex-col items-center w-full"
                >
                  <motion.div 
                    variants={itemVariants}
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    className={cn("w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20", step.bg)}
                  >
                    <step.icon className={cn("w-12 h-12", step.color)} />
                  </motion.div>
                  
                  <motion.h2 variants={itemVariants} className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-4">
                    {step.title}
                  </motion.h2>
                  
                  <motion.p variants={itemVariants} className="text-emerald-400 font-medium text-xl mb-4">
                    {step.subtitle}
                  </motion.p>

                  <motion.div variants={itemVariants} className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-gray-400 text-sm">
                      {step.description}
                    </p>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center w-full"
                >
                  <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mb-6", step.bg)}>
                    <step.icon className={cn("w-10 h-10", step.color)} />
                  </div>
                  
                  <h2 className="text-2xl font-bold text-white mb-3">
                    {step.title}
                  </h2>
                  
                  <p className="text-gray-300 text-lg leading-relaxed">
                    {step.description}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Actions */}
          <div className="p-6 bg-black/20 border-t border-gray-800/50 flex items-center justify-between gap-4">
            {step.isCover ? (
              <div className="w-full flex justify-center">
                <Button
                  onClick={nextStep}
                  className="w-full max-w-xs bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-black font-bold text-lg h-12 shadow-lg shadow-green-500/20 transition-all hover:scale-105"
                >
                  Vamos a empezar
                  <ChevronRight className="w-6 h-6 ml-2" />
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-0"
                >
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  Anterior
                </Button>

                {isLastStep ? (
                  <Button
                    onClick={completeGuide}
                    className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-black font-semibold shadow-lg shadow-green-500/20"
                  >
                    ¡Empezar!
                    <CheckCircle className="w-5 h-5 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={nextStep}
                    className="bg-white/10 hover:bg-white/20 text-white"
                  >
                    Siguiente
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default QuickStartGuideModal;
