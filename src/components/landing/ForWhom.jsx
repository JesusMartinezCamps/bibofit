import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check } from 'lucide-react';

const ForWhom = () => {
    return (
        <section id="for-whom" className="py-24 bg-[#16191d]">
            <div className="container mx-auto px-4 md:px-6">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Diseñado para ambos lados</h2>
                    <p className="text-gray-400">Una experiencia unificada que conecta a profesionales y usuarios.</p>
                </div>

                <div className="max-w-4xl mx-auto">
                    <Tabs defaultValue="coach" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-[#1a1e23] border border-gray-800 p-1 mb-8">
                            <TabsTrigger value="client" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-gray-400">Para Clientes</TabsTrigger>
                            <TabsTrigger value="coach" className="data-[state=active]:bg-green-500 data-[state=active]:text-black text-gray-400">Para Entrenadores</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="coach" className="bg-[#1a1e23] border border-gray-800 rounded-2xl p-8 animate-in fade-in-0 slide-in-from-left-4 duration-500">
                            <div className="grid md:grid-cols-2 gap-8 items-center">
                                <div className="space-y-4">
                                    <h3 className="text-2xl font-bold text-white">Gestiona tu negocio como un Pro</h3>
                                    <p className="text-gray-400">Deja de perder tiempo en tareas administrativas y enfócate en lo que importa: el trato y los resultados de tus clientes.</p>
                                    <ul className="space-y-3">
                                        {['Gestión ilimitada de clientes', 'Librería de plantillas de Dietas y Recetas', 'Automatización de kcal y Macros', 'Gestión de Notificacione y Recordatorios por Cliente'].map((item, i) => (
                                            <li key={i} className="flex items-center gap-3 text-gray-300">
                                                <div className="h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center">
                                                    <Check className="h-3 w-3 text-green-500" />
                                                </div>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="relative h-64 rounded-xl bg-gray-800 overflow-hidden border border-gray-700">
                                    <img alt="Dashboard de entrenador" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" src="https://images.unsplash.com/photo-1625296276703-3fbc924f07b5" />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="client" className="bg-[#1a1e23] border border-gray-800 rounded-2xl p-8 animate-in fade-in-0 slide-in-from-right-4 duration-500">
                             <div className="grid md:grid-cols-2 gap-8 items-center">
                                <div className="relative h-64 rounded-xl bg-gray-800 overflow-hidden border border-gray-700 order-2 md:order-1">
                                    <img alt="App vista cliente" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" src="https://images.unsplash.com/photo-1648134859182-98df6e93ef58" />
                                </div>
                                <div className="space-y-4 order-1 md:order-2">
                                    <h3 className="text-2xl font-bold text-white">Tu plan en tu bolsillo</h3>
                                    <p className="text-gray-400">Accede a tus dietas y rutinas en cualquier momento. Registra tu progreso y mantente motivado.</p>
                                    <ul className="space-y-3">
                                        {['Visualización clara de tu dieta', 'Añade Picoteos y Bibofit se encargará de cuadrarlos', 'Registro e hisotiral de peso', 'Lista de la Compra Inteligente'].map((item, i) => (
                                            <li key={i} className="flex items-center gap-3 text-gray-300">
                                                <div className="h-5 w-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                    <Check className="h-3 w-3 text-blue-500" />
                                                </div>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </section>
    );
};

export default ForWhom;