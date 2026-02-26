import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Utensils, LineChart, Database, Smartphone, Users, CalendarCheck, Scale, ShoppingCart, RefreshCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import AudienceToggle from '@/components/landing/AudienceToggle';

const coachFeatures = [
  {
    icon: <Utensils className="h-6 w-6 text-green-400" />,
    title: 'Planificador Nutricional',
    description:
      'Crea dietas complejas en minutos con cálculo automático de calorías y macros.',
  },
  {
    icon: <CalendarCheck className="h-6 w-6 text-blue-400" />,
    title: 'Plantillas y Planificación',
    description:
      'Reutiliza plantillas y organiza semanas completas de forma rápida para cada cliente.',
  },
  {
    icon: <Database className="h-6 w-6 text-cyan-400" />,
    title: 'Base de Datos Propia',
    description:
      'Añade tus alimentos y recetas privadas para escalar tu método sin empezar de cero.',
  },
  {
    icon: <Users className="h-6 w-6 text-pink-400" />,
    title: 'Gestión de Clientes',
    description:
      'Centraliza historial, notas y seguimiento nutricional en un único flujo operativo.',
  },
  {
    icon: <LineChart className="h-6 w-6 text-yellow-400" />,
    title: 'Seguimiento de Progreso',
    description:
      'Visualiza adherencia y evolución para ajustar los planes con datos reales.',
  },
  {
    icon: <Smartphone className="h-6 w-6 text-indigo-400" />,
    title: 'Ecosistema Coach + App',
    description:
      'Tus clientes registran su día y tú recibes una visión clara para intervenir con criterio.',
  },
];

const clientFeatures = [
  {
    icon: <CalendarCheck className="h-6 w-6 text-blue-400" />,
    title: 'Flexibilidad por Momentos del Día',
    description:
      'Tu plan se adapta a cuándo comes realmente: desayuno, comida, cena o cualquier otro horario.',
  },
  {
    icon: <RefreshCcw className="h-6 w-6 text-green-400" />,
    title: 'Picoteos + Autocuadre',
    description:
      'Añade picoteos o cambios y Bibofit recalcula por ti para mantener tus macros equilibradas.',
  },
  {
    icon: <Database className="h-6 w-6 text-cyan-400" />,
    title: 'Tus Recetas en el Plan',
    description:
      'Crea recetas propias y el sistema ajusta sus alimentos a tus necesidades como lo haría un dietista.',
  },
  {
    icon: <Scale className="h-6 w-6 text-yellow-400" />,
    title: 'Peso con Seguimiento Visual',
    description:
      'Registra tu peso y observa la evolución de forma clara para entender tu progreso.',
  },
  {
    icon: <ShoppingCart className="h-6 w-6 text-orange-400" />,
    title: 'Lista de la Compra Automática',
    description:
      'Se genera desde tu plan y sigue siendo privada para que compres solo lo que necesitas.',
  },
  {
    icon: <Smartphone className="h-6 w-6 text-indigo-400" />,
    title: 'Todo en tu Bolsillo',
    description:
      'Gestiona tu nutrición diaria desde la app sin hojas sueltas ni cálculos manuales.',
  },
];

const FeaturesGrid = ({ audience, onAudienceChange }) => {
    const isCoach = audience === 'coach';
    const features = isCoach ? coachFeatures : clientFeatures;

    return (
        <section id="features" className="py-24 bg-[#1a1e23] relative">
            <div className="container mx-auto px-4 md:px-6 relative z-10">
                <div className="text-center mb-16">
                    <span className="text-green-500 font-semibold tracking-wider uppercase text-sm">Características</span>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mt-2 mb-4">
                        {isCoach ? 'Todo lo que necesitas para escalar' : 'Todo lo que necesitas en tu bolsillo'}
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        {isCoach
                            ? 'Herramientas profesionales para optimizar tu flujo de trabajo y mejorar los resultados de tus clientes.'
                            : 'Funciones diseñadas para que tu plan sea flexible, personal y fácil de cumplir en el día a día.'}
                    </p>
                    <AudienceToggle value={audience} onChange={onAudienceChange} className="mt-6" />
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card className="bg-[#15191e] border-gray-800 hover:border-gray-700 transition-colors h-full">
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center mb-4">
                                        {feature.icon}
                                    </div>
                                    <CardTitle className="text-white text-xl">{feature.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-gray-400 leading-relaxed">
                                        {feature.description}
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FeaturesGrid;
