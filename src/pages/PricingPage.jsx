import React from 'react';
import { Helmet } from 'react-helmet';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import PricingComponent from '@/components/shared/PricingComponent';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const PricingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const comparisonData = [
    { feature: 'Planificación Semanal', free: true, pro: true, coach: true },
    { feature: 'Lista de la Compra', free: true, pro: true, coach: true },
    { feature: 'Registro de Peso', free: true, pro: true, coach: true },
    { feature: 'Recetas Libres', free: true, pro: true, coach: true },
    { feature: 'Autocuadre de Macros', free: false, pro: true, coach: true },
    { feature: 'Equivalencias Automáticas', free: false, pro: true, coach: true },
    { feature: 'Chat con Nutricionista', free: false, pro: true, coach: true },
    { feature: 'Revisión Semanal 1-a-1', free: false, pro: false, coach: true },
    { feature: 'Videollamadas Mensuales', free: false, pro: false, coach: true },
  ];

  const faqs = [
    {
      question: "¿Puedo cambiar de plan en cualquier momento?",
      answer: "Sí, puedes actualizar o degradar tu plan en cualquier momento desde la configuración de tu cuenta. Los cambios de precio se aplicarán en el siguiente ciclo de facturación."
    },
    {
      question: "¿Qué es el autocuadre de macros?",
      answer: "Es nuestra tecnología exclusiva que recalcula automáticamente las cantidades de tus otras comidas cuando añades una receta libre o cambias un ingrediente, asegurando que siempre cumplas tus objetivos diarios."
    },
    {
      question: "¿Hay algún compromiso de permanencia?",
      answer: "No, nuestros planes son mensuales y puedes cancelar cuando quieras sin penalización alguna."
    },
    {
      question: "¿Cómo funciona la asesoría personalizada?",
      answer: "Te asignaremos un dietista certificado que diseñará tu plan desde cero, lo revisará semanalmente y estará disponible para resolver tus dudas específicas a través de chat privado."
    }
  ];

  return (
    <div className="min-h-screen bg-[#1a1e23] text-white font-sans flex flex-col">
      <Helmet>
        <title>Precios y Planes | Bibofit</title>
        <meta name="description" content="Elige el plan perfecto para tus objetivos de fitness y nutrición." />
      </Helmet>

      {/* 
        Logic:
        - If NOT authenticated: Render LandingNavbar.
        - If authenticated: Main Header is rendered by App.jsx layout, so we render nothing here.
      */}
      {!user && (
        <LandingNavbar showNavigationOptions={false} />
      )}

      <main className="pt-10 pb-20 flex-grow">
        <div className="container mx-auto px-4 md:px-6">
            
            <div className="text-center mb-12 max-w-3xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-6">
                Invierte en tu salud
                </h1>
                <p className="text-xl text-gray-400">
                Herramientas profesionales para resultados reales. Sin trucos, solo ciencia y tecnología aplicada a tu nutrición.
                </p>
            </div>

            <PricingComponent showTitle={false} />

            {/* Comparison Table */}
            <div className="max-w-5xl mx-auto mt-24 mb-24">
                <h2 className="text-3xl font-bold text-center mb-12">Comparativa Detallada</h2>
                <div className="overflow-x-auto bg-[#15191e] rounded-xl border border-gray-800 p-6">
                <table className="w-full text-left">
                    <thead>
                    <tr className="border-b border-gray-800">
                        <th className="py-4 px-4 text-gray-400 font-medium">Funcionalidad</th>
                        <th className="py-4 px-4 text-center text-white font-bold">Free</th>
                        <th className="py-4 px-4 text-center text-green-400 font-bold">Pro</th>
                        <th className="py-4 px-4 text-center text-blue-400 font-bold">Asesoría</th>
                    </tr>
                    </thead>
                    <tbody>
                    {comparisonData.map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                        <td className="py-4 px-4 text-gray-300">{row.feature}</td>
                        <td className="py-4 px-4 text-center">
                            {row.free ? <Check className="mx-auto h-5 w-5 text-gray-500" /> : <X className="mx-auto h-5 w-5 text-gray-700" />}
                        </td>
                        <td className="py-4 px-4 text-center">
                            {row.pro ? <Check className="mx-auto h-5 w-5 text-green-500" /> : <X className="mx-auto h-5 w-5 text-gray-700" />}
                        </td>
                        <td className="py-4 px-4 text-center">
                            {row.coach ? <Check className="mx-auto h-5 w-5 text-blue-500" /> : <X className="mx-auto h-5 w-5 text-gray-700" />}
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            </div>

            {/* FAQ Section */}
            <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl font-bold text-center mb-12">Preguntas Frecuentes</h2>
                <Accordion type="single" collapsible className="space-y-4">
                {faqs.map((faq, idx) => (
                    <AccordionItem key={idx} value={`item-${idx}`} className="bg-[#15191e] border border-gray-800 rounded-lg px-6">
                    <AccordionTrigger className="text-lg font-medium hover:text-green-400 hover:no-underline py-6">
                        {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-400 pb-6 leading-relaxed">
                        {faq.answer}
                    </AccordionContent>
                    </AccordionItem>
                ))}
                </Accordion>
            </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
};

export default PricingPage;