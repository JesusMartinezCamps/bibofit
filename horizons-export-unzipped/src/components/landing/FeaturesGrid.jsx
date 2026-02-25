import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Utensils, LineChart, Database, Smartphone, Users, CalendarCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
    {
        icon: <Utensils className="h-6 w-6 text-green-400" />,
        title: "Planificador Nutricional",
        description: "Crea dietas complejas en minutos. Base de datos de alimentos extensa, recetas personalizadas y cálculo automático de calorías."
  },
        {
        icon: <CalendarCheck className="h-6 w-6 text-blue-400" />,
        title: "Planificador de Recetas",
        description: "Planifica rápidamente tus futuras comidas para organizar tu semana, vinculada automáticamente con tu Lista de la Compra..."
    },

            {
        icon: <Smartphone className="h-6 w-6 text-purple-400" />,
        title: "Lista de la Compra Inteligente",
        description: "Se crea automaticamente con los alimentos y Cantidades de tu dieta, además personalízala a tu gusto (de forma privada) para no olvidarte de nada nunca más."
  },
    {
        icon: <Database className="h-6 w-6 text-cyan-400" />,
        title: "Base de Datos Propia",
        description: "Añade tus propios alimentos y recetas privadas. Crea plantillas reutilizables para ahorrar horas de trabajo."
  },
      {
        icon: <LineChart className="h-6 w-6 text-yellow-400" />,
        title: "Seguimiento de Progreso",
        description: "Visualiza la evolución de peso, adherencia al plan y recuento de las recetas que más utilizas. Toda la información clave en un mismo lugar"
  },

          {
        icon: <Users className="h-6 w-6 text-pink-400" />,
        title: "Gestión de Clientes",
        description: "Centraliza toda la información de tus asesorados. Historial médico, notas, chat y recordatorios en un solo lugar."
    },

];

const FeaturesGrid = () => {
    return (
        <section id="features" className="py-24 bg-[#1a1e23] relative">
            <div className="container mx-auto px-4 md:px-6 relative z-10">
                <div className="text-center mb-16">
                    <span className="text-green-500 font-semibold tracking-wider uppercase text-sm">Características</span>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mt-2 mb-4">Todo lo que necesitas para escalar</h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        Herramientas profesionales diseñadas para optimizar tu flujo de trabajo y mejorar los resultados de tus clientes.
                    </p>
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