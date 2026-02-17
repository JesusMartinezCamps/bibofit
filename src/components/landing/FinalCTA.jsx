import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const FinalCTA = () => {
    return (
        <section className="py-24 bg-[#1a1e23] border-t border-gray-800">
             <div className="container mx-auto px-4 md:px-6">
                <div className="bg-gradient-to-r from-green-600 to-emerald-800 rounded-3xl p-8 md:p-16 text-center relative overflow-hidden">
                    {/* Decorative circles */}
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-black/10 rounded-full translate-x-1/2 translate-y-1/2 pointer-events-none" />

                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 relative z-10">
                        ¿Listo para escalar lograr el físico que deseas?
                    </h2>
                    <p className="text-green-100 text-lg max-w-2xl mx-auto mb-10 relative z-10">
                        Aprovecha la mejor app de dietas diseñada para darte la flexibilidad que buscas. Bibofit.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
                         <Link to="/signup">
                            <Button size="lg" className="w-full sm:w-auto bg-white text-green-700 hover:bg-gray-100 font-bold h-14 px-8 text-lg">
                                Crear Cuenta Gratis
                            </Button>
                        </Link>
                        <Link to="/pricing">
                            <Button variant="outline" size="lg" className="w-full sm:w-auto bg-green-800/50 border-white text-white hover:bg-white/10 h-14 px-8 text-lg">
                                Ver todos los precios
                            </Button>
                        </Link>
                    </div>
                </div>
             </div>
        </section>
    );
};

export default FinalCTA;