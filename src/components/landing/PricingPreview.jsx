import React from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const PricingPreview = () => {
    return (
        <section id="pricing" className="py-24 bg-[#1a1e23]">
            <div className="container mx-auto px-4 md:px-6">
                 <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Planes flexibles</h2>
                    <p className="text-gray-400">Comienza gratis y escala a medida que crece tu negocio.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {/* Free Plan */}
                    <Card className="bg-[#15191e] border-gray-800 flex flex-col">
                        <CardHeader>
                            <h3 className="text-xl font-bold text-white">Free</h3>
                            <div className="text-3xl font-bold text-white mt-2">0€ <span className="text-sm font-normal text-gray-500">/mes</span></div>
                            <p className="text-sm text-gray-400 mt-2">Para usar empezar a usar Bibofit, de forma manual.</p>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <ul className="space-y-3 text-sm text-gray-300">
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Asígnación de 1 plantilla de Dieta</li>
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Podrás añadir tus registros de Peso</li>
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Podrás añadir Recetas Libres y tus Picoteos</li>
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Pordrás tambien acceder a tu registro de recetas y tracking de peso</li>
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500"/> Acceso a tus Lista de la Compra Inteligente (y sección Privada completa)</li>
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500"/> Pero... Bibofit no calculará automáticamente para ti</li>
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Link to="/signup" className="w-full">
                                <Button variant="outline" className="w-full border-gray-800 text-green-400 bg-gray-800 hover:text-green-300 hover:bg-gray-700">Empezar Gratis</Button>
                            </Link>
                        </CardFooter>
                    </Card>

                    {/* Pro Plan */}
                    <Card className="bg-[#15191e] border-green-500/50 flex flex-col relative transform md:-translate-y-4 shadow-2xl shadow-green-900/20">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                            <Badge className="bg-green-500 text-black hover:bg-green-600">Más Popular</Badge>
                        </div>
                        <CardHeader>
                            <h3 className="text-xl font-bold text-white">Pro</h3>
                            <div className="text-3xl font-bold text-white mt-2">15€/mes <span className="text-sm font-normal text-gray-500">/mes</span></div>
                            <p className="text-sm text-gray-400 mt-2">Para tener todas las ventajas.</p>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <ul className="space-y-3 text-sm text-gray-300">
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500"/> Todo lo que incluye la versión Free</li>
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500"/> Asignación ilimitada de plantillas de Dietas</li>
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500"/> Tras añadir Recetas Libres o Picoteos Bibofit actualizará el resto de la dieta para ti y siempre tendrás tu dieta actualizada</li>
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500"/> Chat integrado, soporte directo con un Dietista para Resolver dudas nutricionales y/o soporte de la app (sujeto a condiciones)</li>
                            </ul>
                        </CardContent>
                        <CardFooter>
                             <Link to="/signup" className="w-full">
                                <Button className="w-full bg-green-500 hover:bg-green-600 text-black">Prueba Gratis 15 días</Button>
                            </Link>
                        </CardFooter>
                    </Card>

                     {/* Coach Plan */}
                     <Card className="bg-[#15191e] border-gray-800 flex flex-col">
                        <CardHeader>
                            <h3 className="text-xl font-bold text-white">Asesoría Personalizada</h3>
                            <div className="text-3xl font-bold text-white mt-2">35€/mes <span className="text-sm font-normal text-gray-500">/mes</span></div>
                            <p className="text-sm text-gray-400 mt-2">Soporte profesional para asegurarte de conseguir tu cambio físico.</p>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <ul className="space-y-3 text-sm text-gray-300">
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500"/> Todo lo que ofrece la versión Pro</li>
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500"/> Asignación directa a un Dietista, contacto 1 a 1 para establecer tus objetivos, revisión personal de la dieta y seguimiento semanal</li>
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500"/> Soporte prioritario 24/7, en menos de 24h tendrás tu respuesta</li>
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Button variant="outline" className="w-full border-gray-800 text-green-400 bg-gray-800 hover:text-green-300 hover:bg-gray-700">Contactar</Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </section>
    );
};

export default PricingPreview;