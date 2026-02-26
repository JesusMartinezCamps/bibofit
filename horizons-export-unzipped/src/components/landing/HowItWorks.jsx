import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AudienceToggle from '@/components/landing/AudienceToggle';

const HowItWorks = ({ audience, onAudienceChange }) => {

  const steps = useMemo(() => {
    if (audience === 'coach') {
      return [
        {
          number: '01',
          title: 'Añade Clientes',
          description:
            'Invita a tus asesorados. Ellos recibirán acceso inmediato a su portal personal.',
        },
        {
          number: '02',
          title: 'Cliente configura su Perfil',
          description:
            'Define sus preferencias, patologias y alimentos preferidos/odiados.',
        },
        {
          number: '03',
          title: 'Asigna Planes',
          description:
            'Crea dietas desde cero o usa las plantillas inteligentes para asignar en segundos, y modificarlas a tu gusto y al de tu cliente.',
        },
        {
          number: '04',
          title: 'Monitorea y Ajusta',
          description:
            'Recibe feedback. Ajusta el plan basado en datos reales de cumplimiento y progreso. Ajusta las kcal y/o Macros y la app ajusta las cantidades de los alimentos por ti',
        },
      ];
    }

    return [
      {
        number: '01',
        title: 'Configura tu Perfil',
        description:
          'Indica tu objetivo y preferencias para personalizar tu experiencia desde el primer día.',
      },
      {
        number: '02',
        title: 'Define tus Momentos del día',
        description:
          'Configura cuándo sueles comer (desayuno, comida, cena…). Bibofit lo usa para organizar tu plan de forma realista.',
      },
      {
        number: '03',
        title: 'Elige una Plantilla Lista',
        description:
          'Selecciona una plantilla de dieta y modifícala a tu gusto: comidas, recetas y preferencias, sin rigidez.',
      },
      {
        number: '04',
        title: 'Ajuste Automático',
        description:
          'Bibofit recalcula cantidades para que tu día quede equilibrado y encaje con tu objetivo, incluso si cambias algo.',
      },
    ];
  }, [audience]);

  const header = useMemo(() => {
    if (audience === 'coach') {
      return {
        title: 'Cómo funciona Bibofit',
        subtitle: 'Cuatro pasos sencillos para gestionar los planes de nutrición de tus clientes con claridad.',
      };
    }
    return {
      title: 'Cómo funciona Bibofit',
      subtitle: 'Cuatro pasos sencillos para llevar una dieta flexible que te asegura resulados.',
    };
  }, [audience]);

  return (
    <section id="how-it-works" className="py-24 bg-[#16191d]">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {header.title}
          </h2>
          <p className="text-gray-400 mb-6">{header.subtitle}</p>

          <AudienceToggle value={audience} onChange={onAudienceChange} />
        </div>

        <div className="relative">
          <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-gray-800 -translate-y-1/2 z-0" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            <AnimatePresence mode="wait">
              {steps.map((step, index) => (
                <motion.div
                  key={`${audience}-${step.number}`}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18, delay: index * 0.05 }}
                  className="bg-[#1a1e23] p-6 rounded-2xl border border-gray-800 flex flex-col items-center text-center group hover:border-green-500/30 transition-colors"
                >
                  <div className="w-16 h-16 rounded-full bg-gray-800 border-4 border-[#16191d] flex items-center justify-center text-2xl font-bold text-green-500 mb-6 group-hover:bg-green-500/10 group-hover:scale-110 transition-all duration-300 shadow-lg">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
