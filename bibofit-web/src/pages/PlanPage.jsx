import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { Apple, Dumbbell } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const PlanPage = () => {
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  const dietDate = dateParam || format(new Date(), 'yyyy-MM-dd');
  const dietDateParsed = parseISO(dietDate);
  const formattedDate = format(dietDateParsed, "d 'de' MMMM 'de' yyyy", { locale: es });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return (
    <>
      <Helmet>
        <title>Tu Plan - Gsus Martz</title>
        <meta name="description" content="Accede a tu plan de dieta y entrenamiento personalizado." />
      </Helmet>
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] md:min-h-[calc(100vh-120px)] py-8 md:py-12 container mx-auto px-4">
        <div className="w-full max-w-4xl text-center flex flex-col">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 md:mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:bg-clip-text dark:text-transparent dark:bg-gradient-to-r dark:from-white dark:to-gray-400">
              El Plan del {capitalizedDate}
            </h1>
            <p className="text-xl text-muted-foreground mt-2">¿Qué quieres consultar?</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <Link
                to={`/plan/dieta/${dietDate}`}
                className="group block rounded-2xl bg-muted/65 border-2 border-border/80 hover:border-[#5ebe7d] transition-all duration-300 min-h-[200px] md:h-72 relative overflow-hidden flex flex-col justify-center items-center p-4 md:p-8"
              >
                <div className="absolute -inset-px bg-gradient-to-r from-green-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex flex-col items-center text-center">
                  <div className="p-4 md:p-6 bg-[#5ebe7d]/20 rounded-full mb-4 md:mb-6 border border-[#5ebe7d]/30">
                    <Apple className="w-10 h-10 md:w-16 md:h-16 text-[#5ebe7d]" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2 md:mb-3">Plan de Dieta</h2>
                  <p className="text-muted-foreground text-sm md:text-base">Ver mis comidas del día, registrar el peso o planificar la semana.</p>
                </div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <Link
                to="/plan/entreno"
                className="group block rounded-2xl bg-muted/65 border-2 border-border/80 hover:border-[#F44C40] transition-all duration-300 min-h-[200px] md:h-72 relative overflow-hidden flex flex-col justify-center items-center p-4 md:p-8"
              >
                <div className="absolute -inset-px bg-gradient-to-r from-red-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex flex-col items-center text-center">
                  <div className="p-4 md:p-6 bg-[#F44C40]/20 rounded-full mb-4 md:mb-6 border border-[#F44C40]/30">
                    <Dumbbell className="w-10 h-10 md:w-16 md:h-16 text-[#F44C40]" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2 md:mb-3">Plan de Entreno</h2>
                  <p className="text-muted-foreground text-sm md:text-base">Próximamente disponible — tus rutinas y ejercicios aquí.</p>
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