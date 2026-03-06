import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, User, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ProblemSolution = ({ audience = 'user', onAudienceChange, onOpenMobileDemo }) => {
  const handleAudienceChange = (value) => {
    onAudienceChange?.(value);
  };

  const copy = useMemo(() => {
    if (audience === 'coach') {
      return {
        title: '¿Cansado de hojas de cálculo y PDFs estáticos?',
        subtitle:
          'La gestión de clientes suele ser caótica. Bibofit convierte el caos en claridad con un sistema práctico y fácil de mantener.',
        problemTitle: 'El Problema',
        solutionTitle: 'La Solución Bibofit',
        problem: [
          'Planes nutricionales en Excel/PDF difíciles de actualizar y mantener.',
          'Feedback del cliente disperso entre WhatsApp, notas y mensajes.',
          'Cuesta medir la adherencia real y detectar dónde se rompe el plan.',
        ],
        solution: [
          'Editor de dietas inteligente con cálculo automático de macros.',
          'App para clientes donde registran sus comidas (nutrición).',
          'Visión clara del progreso y señales de adherencia para ajustar el plan.',
        ],
      };
    }

    return {
      title: '¿Cansado de dietas rígidas que no encajan con tu día a día?',
      subtitle:
        'Bibofit te ayuda a seguir una nutrición flexible y personalizada. Tú eliges, y el plan se adapta para que sigas avanzando sin rigidez.',
      problemTitle: 'Lo que suele pasar',
      solutionTitle: 'Cómo te ayuda Bibofit',
      problem: [
        'Te sales un poco del plan y sientes que “ya lo has fastidiado”.',
        'Si picoteas algo, o tienes planes sociales; seguir la dieta se vuelve difícil.',
        'Crees que llevar una dieta saludable es estar constantemente restringiendote.',
      ],
      solution: [
        'Planes personalizados que se adaptan a tu estilo de vida (sin rigidez).',
        'Si cambias una comida o “picas”, Bibofit reajusta el día para mantener el equilibrio.',
        'Introduce picoteos y tus recetas favoritas, Bibofit se encarga de cuadrar tus Calorías por ti.',
      ],
    };
  }, [audience]);

  return (
    <section id="problem" className="pb-20 bg-card/60">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Prueba cómo sería si tu{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-300 dark:to-emerald-400">
              Dietista
            </span>{' '}
            se convirtiera en{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-300 dark:to-emerald-400">
              Software
            </span>
          </h2>
          <div className="mb-4 sm:hidden">
            <Button
              type="button"
              size="lg"
              onClick={onOpenMobileDemo}
              className="h-12 px-6 bg-blue-600 text-blue-50 hover:bg-blue-700 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400 border border-blue-700/40 dark:border-blue-300/40 shadow-sm"
            >
              Descubre como se ve la app
            </Button>
          </div>
          <p className="text-muted-foreground text-lg mb-6">
            Bibofit es una app desarrollada por una{' '}
            <span className="text-green-400 font-semibold">única persona</span>, con el objetivo de{' '}
            <span className="text-green-400 font-semibold">facilitar</span> lo máximo posible a las personas que puedan llevar una{' '}
            <span className="text-green-400 font-semibold">dieta saludable</span>. Mira lo que ofrece.
          </p>

          <RoleToggle value={audience} onChange={handleAudienceChange} />
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={`problem-${audience}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              whileHover={{ y: -5 }}
              className="p-8 rounded-2xl bg-blue-900/10 border border-blue-500/20 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <AlertTriangle className="w-32 h-32 text-blue-500" />
              </div>

              <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                {copy.problemTitle}
              </h3>

              <ul className="space-y-4 text-muted-foreground">
                {copy.problem.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-blue-500 mt-1">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={`solution-${audience}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              whileHover={{ y: -5 }}
              className="p-8 rounded-2xl bg-green-900/10 border border-green-500/20 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <CheckCircle className="w-32 h-32 text-green-500" />
              </div>

              <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                {copy.solutionTitle}
              </h3>

              <ul className="space-y-4 text-muted-foreground">
                {copy.solution.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

function RoleToggle({ value, onChange }) {
  return (
    <div className="flex justify-center">
      <div className="relative inline-flex items-center rounded-2xl border border-border bg-muted/70 p-1 backdrop-blur">
        <motion.div
          layout
          className="absolute top-1 bottom-1 rounded-xl bg-emerald-200 border border-emerald-500/45 shadow-sm dark:bg-background dark:border-border"
          style={{
            left: value === 'user' ? 0 : '50%',
            width: 'calc(50% - 8px)',
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        />

        <button
          type="button"
          onClick={() => onChange('user')}
          className={`relative z-10 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60 ${
            value === 'user'
              ? 'text-emerald-950 dark:text-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-pressed={value === 'user'}
        >
          <User className="h-4 w-4" />
          Soy cliente
        </button>

        <button
          type="button"
          onClick={() => onChange('coach')}
          className={`relative z-10 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60 ${
            value === 'coach'
              ? 'text-emerald-950 dark:text-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-pressed={value === 'coach'}
        >
          <Briefcase className="h-4 w-4" />
          Soy entrenador
        </button>
      </div>
    </div>
  );
}

export default ProblemSolution;
