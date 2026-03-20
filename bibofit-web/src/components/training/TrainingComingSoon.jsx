import React from 'react';
import { Dumbbell, Target, TrendingUp, Zap, BarChart2, Trophy } from 'lucide-react';

const features = [
  {
    icon: <Target className="w-5 h-5 text-[#5ebe7d]" />,
    text: 'Seguimiento de cargas y series en tiempo real',
  },
  {
    icon: <TrendingUp className="w-5 h-5 text-[#5ebe7d]" />,
    text: 'Progresión inteligente semana a semana',
  },
  {
    icon: <BarChart2 className="w-5 h-5 text-[#5ebe7d]" />,
    text: 'Estadísticas de volumen, intensidad y recuperación',
  },
  {
    icon: <Zap className="w-5 h-5 text-[#5ebe7d]" />,
    text: 'Rutinas periodizadas adaptadas a tus objetivos',
  },
  {
    icon: <Trophy className="w-5 h-5 text-[#5ebe7d]" />,
    text: 'Récords personales y hitos de progreso',
  },
];

const TrainingComingSoon = () => {
  return (
    <div className="min-h-screen bg-[#282d34] flex flex-col items-center justify-center px-6 py-16">
      {/* Icon */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-red-600/10 border border-red-600/30 flex items-center justify-center">
          <Dumbbell className="w-10 h-10 text-red-600" />
        </div>
        <span className="absolute -top-1 -right-1 bg-red-600 text-red-100 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
          Pronto
        </span>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-white text-center mb-3">
        Tu zona de entreno llegará muy pronto
      </h1>
      <p className="text-gray-400 text-center max-w-md mb-10 leading-relaxed">
        Esta en construcción tu mejor aliado para trackear tu entreno y progeso..
        Zona de entrenamiento: <span className="text-white font-medium">datos reales para los resultados que buscas.</span>
      </p>

      {/* Feature list */}
      <div className="w-full max-w-sm space-y-3 mb-10">
        {features.map(({ icon, text }, i) => (
          <div key={i} className="flex items-center gap-3 dark:bg-[#1e2228] border border-white/5 rounded-xl px-4 py-3">
            {icon}
            <span className="text-sm text-gray-300">{text}</span>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-500 text-center max-w-xs">
        Esta sección está en desarrollo activo. Atento a las Notificaciones para saber en cuanto esté disponible para ti.
      </p>
    </div>
  );
};

export default TrainingComingSoon;
