import React from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const PRICING_TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '0€',
    period: '/mes',
    description: 'Para empezar a usar Bibofit de forma manual.',
    features: [
      { text: 'Asignación de 1 plantilla de Dieta', included: true },
      { text: 'Registro de Peso y Progreso', included: true },
      { text: 'Recetas Libres y Picoteos', included: true },
      { text: 'Lista de la Compra Inteligente', included: true },
      { text: 'Autocuadre de Macros', included: false },
      { text: 'Soporte Prioritario', included: false },
    ],
    ctaText: 'Empezar Gratis',
    ctaLink: '/signup',
    ctaVariant: 'outline',
    highlight: false
  },
  {
    id: 'premium',
    name: 'Pro',
    price: '15€',
    period: '/mes',
    description: 'Automatiza tu nutrición con todas las ventajas.',
    features: [
      { text: 'Todo lo incluido en Free', included: true },
      { text: 'Asignación ilimitada de plantillas', included: true },
      { text: 'Autocuadre Automático de Dietas', included: true },
      { text: 'Actualización dinámica de macros', included: true },
      { text: 'Chat integrado con soporte básico', included: true },
      { text: 'Análisis avanzado de progreso', included: true },
    ],
    ctaText: 'Prueba Gratis 15 días',
    ctaLink: '/signup',
    ctaVariant: 'default',
    highlight: true,
    highlightText: 'Más Popular'
  },
  {
    id: 'coach',
    name: 'Asesoría',
    price: '35€',
    period: '/mes',
    description: 'Soporte profesional para garantizar resultados.',
    features: [
      { text: 'Todo lo incluido en Pro', included: true },
      { text: 'Asignación directa a un Dietista', included: true },
      { text: 'Contacto 1 a 1 y revisión personal', included: true },
      { text: 'Seguimiento semanal detallado', included: true },
      { text: 'Soporte Prioritario 24/7', included: true },
      { text: 'Ajustes ilimitados de plan', included: true },
    ],
    ctaText: 'Contactar',
    ctaLink: '/contact', // Assuming a contact route or anchor
    ctaVariant: 'outline',
    highlight: false
  }
];

const PricingComponent = ({ showTitle = true, className }) => {
  return (
    <section id="pricing" className={cn("py-12 bg-transparent", className)}>
      <div className="container mx-auto px-4 md:px-6">
        {showTitle && (
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Planes flexibles</h2>
            <p className="text-gray-400">Comienza gratis y escala a medida que crece tu negocio.</p>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {PRICING_TIERS.map((tier) => (
            <Card 
              key={tier.id} 
              className={cn(
                "bg-[#15191e] border-gray-800 flex flex-col relative transition-all duration-300 hover:border-gray-700",
                tier.highlight && "border-green-500/50 shadow-2xl shadow-green-900/10 transform md:-translate-y-4 z-10"
              )}
            >
              {tier.highlight && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <Badge className="bg-green-500 text-black hover:bg-green-600 px-4 py-1">{tier.highlightText}</Badge>
                </div>
              )}
              
              <CardHeader>
                <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                <div className="text-3xl font-bold text-white mt-2">
                  {tier.price} <span className="text-sm font-normal text-gray-500">{tier.period}</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">{tier.description}</p>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-4">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm">
                      {feature.included ? (
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-gray-600 flex-shrink-0" />
                      )}
                      <span className={feature.included ? "text-gray-300" : "text-gray-500 line-through decoration-gray-600"}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Link to={tier.ctaLink} className="w-full">
                  <Button 
                    variant={tier.ctaVariant === 'outline' ? 'outline' : 'default'}
                    className={cn(
                      "w-full font-semibold",
                      tier.ctaVariant === 'outline' 
                        ? "border-gray-800 text-green-400 bg-gray-800 hover:text-green-300 hover:bg-gray-700 hover:border-gray-600" 
                        : "bg-green-500 hover:bg-green-600 text-black shadow-lg shadow-green-900/20"
                    )}
                  >
                    {tier.ctaText}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingComponent;