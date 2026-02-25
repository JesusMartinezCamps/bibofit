import React from 'react';
    import { Helmet } from 'react-helmet';
    import { motion } from 'framer-motion';
    import { Link } from 'react-router-dom';
    import { Apple, Dumbbell } from 'lucide-react';

    const PlanPage = () => {
      return (
        <>
          <Helmet>
            <title>Tu Plan - Gsus Martz</title>
            <meta name="description" content="Accede a tu plan de dieta y entrenamiento personalizado." />
          </Helmet>
          <main className="flex flex-col items-center justify-center h-[calc(100vh-80px)] md:h-auto md:min-h-[calc(100vh-120px)] container mx-auto px-4 md:py-12">
            <div className="w-full max-w-4xl text-center flex flex-col h-full md:h-auto">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-8 md:mb-12 pt-8 md:pt-0"
              >
                <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                  El Plan
                </h1>
                <p className="text-xl text-gray-400 mt-2">¿Qué quieres consultar?</p>
              </motion.div>

              <div className="flex-grow md:flex-grow-0 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-8 h-full">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full"
                >
                  <Link
                    to="/plan/dieta"
                    className="group block rounded-2xl bg-slate-800/50 border-2 border-slate-700/80 hover:border-[#5ebe7d] transition-all duration-300 h-full relative overflow-hidden flex flex-col justify-center items-center p-4 md:p-8"
                  >
                    <div className="absolute -inset-px bg-gradient-to-r from-green-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative flex flex-col items-center text-center">
                      <div className="p-4 md:p-6 bg-[#5ebe7d]/20 rounded-full mb-4 md:mb-6 border border-[#5ebe7d]/30">
                        <Apple className="w-12 h-12 md:w-16 md:h-16 text-[#5ebe7d]" />
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 md:mb-3">Plan de Dieta</h2>
                      <p className="text-gray-400 text-sm md:text-base">Consulta tus comidas, recetas y pautas nutricionales para cada día.</p>
                    </div>
                  </Link>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full"
                >
                  <Link
                    to="/plan/entreno"
                    className="group block rounded-2xl bg-slate-800/50 border-2 border-slate-700/80 hover:border-[#F44C40] transition-all duration-300 h-full relative overflow-hidden flex flex-col justify-center items-center p-4 md:p-8"
                  >
                    <div className="absolute -inset-px bg-gradient-to-r from-red-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative flex flex-col items-center text-center">
                      <div className="p-4 md:p-6 bg-[#F44C40]/20 rounded-full mb-4 md:mb-6 border border-[#F44C40]/30">
                        <Dumbbell className="w-12 h-12 md:w-16 md:h-16 text-[#F44C40]" />
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 md:mb-3">Plan de Entreno</h2>
                      <p className="text-gray-400 text-sm md:text-base">Accede a tus rutinas, ejercicios y progresión de entrenamiento.</p>
                    </div>
                  </Link>
                </motion.div>
              </div>
            </div>
          </main>
        </>
      );
    };
    export default PlanPage;