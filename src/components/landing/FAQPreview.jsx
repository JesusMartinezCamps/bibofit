import React from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

const FAQPreview = () => {
    return (
        <section id="faq" className="py-24 bg-[#16191d]">
            <div className="container mx-auto px-4 md:px-6 max-w-3xl">
                <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-12">
                    Preguntas Frecuentes
                </h2>
                
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1" className="border-gray-800">
                        <AccordionTrigger className="text-gray-200 hover:text-green-400">¿Puedo probar la plataforma antes de pagar?</AccordionTrigger>
                        <AccordionContent>
                            Sí, ofrecemos un plan gratuito permanente para hasta 3 clientes. Además, todos los planes de pago incluyen un periodo de prueba de 14 días sin compromiso.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2" className="border-gray-800">
                        <AccordionTrigger className="text-gray-200 hover:text-green-400">¿Funciona para nutricionistas y entrenadores?</AccordionTrigger>
                        <AccordionContent>
                            Absolutamente. Bibofit está diseñado para ser flexible. Puedes usar solo el módulo de nutrición, solo el de entrenamiento, o ambos para ofrecer un servicio integral.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3" className="border-gray-800">
                        <AccordionTrigger className="text-gray-200 hover:text-green-400">¿Mis clientes tienen que pagar por la app?</AccordionTrigger>
                        <AccordionContent>
                            No. El acceso para tus clientes es completamente gratuito. Tú pagas por la plataforma de gestión y ellos reciben la app como parte de tu servicio.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-4" className="border-gray-800">
                        <AccordionTrigger className="text-gray-200 hover:text-green-400">¿Puedo importar mis propias recetas?</AccordionTrigger>
                        <AccordionContent>
                            Sí, puedes crear y guardar tus propias recetas, alimentos y ejercicios en tu base de datos privada para usarlos en cualquier plan.
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </section>
    );
};

export default FAQPreview;