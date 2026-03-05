import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Utensils, LineChart, Database, Smartphone, Users, CalendarCheck, User, Briefcase } from 'lucide-react';
import { motion } from 'framer-motion';

const FEATURES_BY_AUDIENCE = {
  coach: [
    {
      icon: <Utensils className="h-6 w-6 text-green-400" />,
      title: 'Planificador Nutricional',
      description:
        'Crea y ajusta dietas de tus clientes en minutos, con cálculos automáticos de calorías y macros para ahorrar tiempo en cada revisión.',
    },
    {
      icon: <CalendarCheck className="h-6 w-6 text-blue-400" />,
      title: 'Planificador de Recetas',
      description:
        'Organiza las comidas de tus clientes por días y semanas para mantener estructura y claridad, sin rehacer planes manualmente.',
    },
    {
      icon: <Smartphone className="h-6 w-6 text-purple-400" />,
      title: 'Lista de la Compra Inteligente',
      description:
        'Tus clientes reciben su lista de la compra automáticamente según el plan, y pueden personalizarla en privado sin romper la organización general.',
    },
    {
      icon: <Database className="h-6 w-6 text-cyan-400" />,
      title: 'Base de Datos Propia',
      description:
        'Guarda alimentos, recetas y plantillas reutilizables para trabajar más rápido y mantener consistencia entre asesorados.',
    },
    {
      icon: <LineChart className="h-6 w-6 text-yellow-400" />,
      title: 'Seguimiento de Clientes',
      description:
        'Visualiza el progreso de peso y adherencia de cada cliente para detectar desajustes pronto y hacer cambios con criterio.',
    },
    {
      icon: <Users className="h-6 w-6 text-pink-400" />,
      title: 'Gestión de Clientes',
      description:
        'Centraliza historial, notas y contexto de cada persona en un único espacio para reducir fricción y mejorar tu servicio.',
    },
  ],
  user: [
    {
      icon: <Utensils className="h-6 w-6 text-green-400" />,
      title: 'Plan Nutricional Flexible',
      description:
        'Sigue una dieta adaptada a ti con ajustes inteligentes para que puedas avanzar sin vivir con sensación de restricción.',
    },
    {
      icon: <CalendarCheck className="h-6 w-6 text-blue-400" />,
      title: 'Planificador Semanal',
      description:
        'Visualiza tus comidas por día y por semana para organizarte mejor y mantener constancia incluso con días cambiantes.',
    },
    {
      icon: <Smartphone className="h-6 w-6 text-purple-400" />,
      title: 'Lista de la Compra Inteligente',
      description:
        'Recibe automáticamente tu lista con cantidades calculadas y añade tus extras privados para tener todo bajo control.',
    },
    {
      icon: <Database className="h-6 w-6 text-cyan-400" />,
      title: 'Recetas y Alimentos Favoritos',
      description:
        'Guarda tus recetas y alimentos preferidos para personalizar el plan sin complicaciones y mantenerlo realmente tuyo.',
    },
    {
      icon: <LineChart className="h-6 w-6 text-yellow-400" />,
      title: 'Seguimiento de Progreso',
      description:
        'Consulta tu evolución de peso y adherencia para entender cómo avanzas y mantener la motivación con datos claros.',
    },
    {
      icon: <Users className="h-6 w-6 text-pink-400" />,
      title: 'Experiencia Guiada',
      description:
        'Todo está pensado para que seguir tu plan sea cómodo: menos fricción en el día a día y más foco en tus resultados.',
    },
  ],
};

const headerByAudience = {
  coach: {
    title: 'Todo lo que necesitas para escalar',
    subtitle:
      'Herramientas para ahorrar tiempo, mejorar el seguimiento de tus clientes y ofrecerles una experiencia más cómoda.',
  },
  user: {
    title: 'Todo lo que necesitas para progresar',
    subtitle:
      'Funciones pensadas para que cuidar tu dieta sea más fácil, flexible y sostenible en tu día a día.',
  },
};

const FeaturesGrid = ({ audience = 'user', onAudienceChange }) => {
  const features = useMemo(() => FEATURES_BY_AUDIENCE[audience] ?? FEATURES_BY_AUDIENCE.user, [audience]);
  const header = useMemo(() => headerByAudience[audience] ?? headerByAudience.user, [audience]);

  return (
    <section id="features" className="py-24 bg-background relative">
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center mb-16">
          <span className="text-green-500 font-semibold tracking-wider uppercase text-sm">Características</span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mt-2 mb-4">{header.title}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">{header.subtitle}</p>

          <RoleToggle value={audience} onChange={onAudienceChange} />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={`${audience}-${feature.title}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
            >
              <Card className="bg-card border-border hover:border-border transition-colors h-full">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-foreground text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
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
          onClick={() => onChange?.('user')}
          className={`relative z-10 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60 ${
            value === 'user' ? 'text-emerald-950 dark:text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-pressed={value === 'user'}
        >
          <User className="h-4 w-4" />
          Soy cliente
        </button>

        <button
          type="button"
          onClick={() => onChange?.('coach')}
          className={`relative z-10 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60 ${
            value === 'coach' ? 'text-emerald-950 dark:text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
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

export default FeaturesGrid;
