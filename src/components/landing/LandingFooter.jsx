import React from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, Instagram, Twitter, Linkedin } from 'lucide-react';

const LandingFooter = () => {
    return (
        <footer className="bg-[#16191d] border-t border-gray-800 pt-16 pb-8">
            <div className="container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                    {/* Brand */}
                    <div className="col-span-1 md:col-span-1">
                         <Link to="/home" className="flex items-center gap-2 font-bold text-2xl text-white mb-4">
                            <div className="bg-gradient-to-br from-green-400 to-green-600 p-1.5 rounded-lg">
                                <Dumbbell className="h-5 w-5 text-black" />
                            </div>
                            <span>Bibofit</span>
                        </Link>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Plataforma integral para la gestión de entrenamiento y nutrición. Potenciamos a los profesionales del fitness.
                        </p>
                    </div>

                    {/* Links Column 1 */}
                    <div>
                        <h4 className="text-white font-bold mb-4">Producto</h4>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li><a href="#features" className="hover:text-green-400">Características</a></li>
                            <li><a href="#pricing" className="hover:text-green-400">Precios</a></li>
                            <li><a href="#for-whom" className="hover:text-green-400">Para Clientes</a></li>
                            <li><a href="#for-whom" className="hover:text-green-400">Para Entrenadores</a></li>
                        </ul>
                    </div>

                    {/* Links Column 2 */}
                    <div>
                        <h4 className="text-white font-bold mb-4">Compañía</h4>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li><Link to="/about" className="hover:text-green-400">Sobre Nosotros</Link></li>
                            <li><Link to="/contact" className="hover:text-green-400">Contacto</Link></li>
                            <li><Link to="/blog" className="hover:text-green-400">Blog</Link></li>
                            <li><Link to="/terms" className="hover:text-green-400">Términos y Condiciones</Link></li>
                        </ul>
                    </div>

                    {/* Socials */}
                    <div>
                         <h4 className="text-white font-bold mb-4">Síguenos</h4>
                         <div className="flex gap-4">
                            <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-green-500 hover:text-black transition-all">
                                <Instagram className="h-5 w-5" />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-green-500 hover:text-black transition-all">
                                <Twitter className="h-5 w-5" />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-green-500 hover:text-black transition-all">
                                <Linkedin className="h-5 w-5" />
                            </a>
                         </div>
                    </div>
                </div>

                <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-500">
                    <p>&copy; {new Date().getFullYear()} Bibofit. Todos los derechos reservados.</p>
                </div>
            </div>
        </footer>
    );
};

export default LandingFooter;