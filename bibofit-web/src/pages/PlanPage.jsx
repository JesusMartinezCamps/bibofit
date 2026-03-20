import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { Apple, Dumbbell, Weight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const PlanPage = () => {
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  const dietDate = dateParam || format(new Date(), 'yyyy-MM-dd');
  const dietDateParsed = parseISO(dietDate);
  const formattedDate = format(dietDateParsed, "d 'de' MMMM 'de' yyyy", { locale: es });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  const weightLogPath = `/registro-peso?date=${dietDate}`;

  return (
    <>
      <Helmet>
        <title>Tu Plan - Gsus Martz</title>
        <meta name="description" content="Accede a tu plan de dieta y entrenamiento personalizado." />
      </Helmet>
      <main className="h-full overflow-hidden container mx-auto px-4">
        <div className="w-full max-w-4xl mx-auto h-full flex flex-col">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="pt-6 md:pt-10 text-center"
          >
            <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:bg-clip-text dark:text-transparent dark:bg-gradient-to-r dark:from-white dark:to-gray-400">
              El Plan del {capitalizedDate}
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="mt-3 md:mt-5"
          >
            <Link
              to={weightLogPath}
              className="group block rounded-2xl bg-violet-100/70 dark:bg-violet-900/30 border-2 border-violet-400/60 dark:border-violet-500/50 transition-all duration-300 relative overflow-hidden h-14 md:h-16 px-4 md:px-6 hover:bg-gradient-to-br hover:from-violet-100/70 hover:to-violet-50/80 dark:hover:from-violet-900/30 dark:hover:to-violet-700/35"
            >
              <div className="absolute -inset-px bg-gradient-to-r from-violet-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative h-full flex items-center justify-center gap-3">
                <Weight className="w-5 h-5 text-violet-700 dark:text-violet-300" />
                <span className="text-sm md:text-lg font-semibold text-violet-700 dark:text-violet-300">
                  Añadir registro de peso para hoy
                </span>
              </div>
            </Link>
          </motion.div>

          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <Link
                to={`/plan/dieta/${dietDate}`}
                className="group block rounded-2xl bg-muted/65 border-2 border-border/80 hover:border-[#5ebe7d] transition-all duration-300 h-[clamp(128px,19vh,180px)] md:h-72 relative overflow-hidden flex flex-col justify-center items-center p-4 md:p-8"
              >
                <div className="absolute -inset-px bg-gradient-to-r from-green-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex flex-col items-center text-center">
                  <div className="p-3 md:p-6 bg-[#5ebe7d]/20 rounded-full mb-3 md:mb-6 border border-[#5ebe7d]/30">
                    <Apple className="w-9 h-9 md:w-16 md:h-16 text-[#5ebe7d]" />
                  </div>
                  <h2 className="text-xl md:text-3xl font-bold text-foreground mb-1 md:mb-3">Plan de Dieta</h2>
                  <p className="text-muted-foreground text-[11px] leading-tight md:text-base">Ver mis comidas del día, registrar el peso o planificar la semana.</p>
                </div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <Link
                to={`/plan/entreno/${dietDate}`}
                className="group block rounded-2xl bg-muted/65 border-2 border-border/80 hover:border-[#F44C40] transition-all duration-300 h-[clamp(128px,19vh,180px)] md:h-72 relative overflow-hidden flex flex-col justify-center items-center p-4 md:p-8"
              >
                <div className="absolute -inset-px bg-gradient-to-r from-red-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex flex-col items-center text-center">
                  <div className="p-3 md:p-6 bg-[#F44C40]/20 rounded-full mb-3 md:mb-6 border border-[#F44C40]/30">
                    <Dumbbell className="w-9 h-9 md:w-16 md:h-16 text-[#F44C40]" />
                  </div>
                  <h2 className="text-xl md:text-3xl font-bold text-foreground mb-1 md:mb-3">Plan de Entreno</h2>
                  <p className="text-muted-foreground text-[11px] leading-tight md:text-base">Abre tu sesión de hoy con histórico de pesos y repeticiones.</p>
                </div>
              </Link>
            </motion.div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};
export default PlanPage;
