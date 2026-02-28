import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Quote } from 'lucide-react';

const testimonials = [
    {
        name: "Carlos M.",
        role: "Entrenador Personal",
        content: "Bibofit me ha permitido duplicar mi cartera de clientes sin aumentar mis horas de trabajo. Las plantillas de dieta son un salvavidas.",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces"
    },
    {
        name: "Laura G.",
        role: "Nutricionista Deportiva",
        content: "A mis pacientes les encanta la app. Pueden ver sus recetas y marcar lo que comen. La adherencia ha mejorado notablemente.",
        image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=faces"
    },
    {
        name: "Javier R.",
        role: "Coach Online",
        content: "La mejor inversión para mi negocio. Todo está centralizado y se ve muy profesional. El soporte es excelente.",
        image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=faces"
    }
];

const Testimonials = () => {
    return (
        <section className="py-24 bg-[#1a1e23]">
            <div className="container mx-auto px-4 md:px-6">
                <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-16">
                    Confían en nosotros
                </h2>

                <div className="grid md:grid-cols-3 gap-8">
                    {testimonials.map((t, i) => (
                        <Card key={i} className="bg-[#15191e] border-gray-800 relative">
                            <CardContent className="pt-10">
                                <Quote className="absolute top-6 left-6 h-8 w-8 text-green-500/20" />
                                <p className="text-gray-300 italic mb-6 relative z-10">
                                    "{t.content}"
                                </p>
                                <div className="flex items-center gap-4">
                                    <img 
                                        src={t.image} 
                                        alt={t.name} 
                                        className="w-12 h-12 rounded-full object-cover border-2 border-green-500/30"
                                    />
                                    <div>
                                        <h4 className="font-bold text-white">{t.name}</h4>
                                        <p className="text-xs text-green-500">{t.role}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Testimonials;