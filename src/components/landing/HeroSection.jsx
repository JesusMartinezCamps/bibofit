import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  CalendarDays,
  Shield,
  FileText,
  ShoppingCart,
  User2,
  ChevronLeft,
  ChevronRight,
  Scale,
  Flame,
  Drumstick,
  Wheat,
  Droplet,
  Apple,
  UtensilsCrossed,
  ChevronDown,
  ListOrdered,
} from 'lucide-react';

/* -----------------------------
 Helpers (random + formatting)
------------------------------ */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const formatDaysAgo = (days) => `7-1-2026 (hacía ${days} días)`;

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const dowEs = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

/* -----------------------------
 Reusable: Tap + Hover button
 FIX: handler composition safe
------------------------------ */
const Tap = ({
  as: Comp = motion.button,
  className = '',
  flashClassName = '',
  onTapAction,
  children,
  type = 'button',
  onClick,
  onTap,
  ...rest
}) => {
  const [flash, setFlash] = useState(false);
  const tRef = useRef(null);

  const handleTap = (e) => {
    if (tRef.current) window.clearTimeout(tRef.current);
    setFlash(true);
    tRef.current = window.setTimeout(() => setFlash(false), 160);

    onTapAction?.(e);
    onClick?.(e);
    onTap?.(e);
  };

  return (
    <Comp
      type={type}
      onClick={handleTap}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 550, damping: 32 }}
      className={`transition-colors duration-200 ${className} ${flash ? flashClassName : ''}`}
      {...rest}
    >
      {children}
    </Comp>
  );
};

/* -----------------------------
 Animated number
------------------------------ */
const AnimatedNumber = ({ value, className = '' }) => (
  <AnimatePresence mode="popLayout">
    <motion.span
      key={String(value)}
      initial={{ opacity: 0, y: 8, filter: 'blur(2px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
      transition={{ duration: 0.18 }}
      className={className}
    >
      {value}
    </motion.span>
  </AnimatePresence>
);

/* -----------------------------
 UI: Macro progress pill
------------------------------ */
const MacroPill = ({ valuePct = 35, colorClass = 'bg-red-500', label = '35%' }) => (
  <div className="mt-3">
    <div className="h-5 rounded-full bg-[#242C34] border border-[#2B3540] overflow-hidden relative">
      <div
        className={`h-full ${colorClass} transition-[width] duration-500 ease-out`}
        style={{ width: `${clamp(valuePct, 0, 100)}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white/90">
        {label}
      </div>
    </div>
  </div>
);

const LongBar = ({ valuePct = 47, colorClass = 'bg-orange-500' }) => (
  <div className="mt-3 relative">
    <div className="h-5 rounded-full bg-[#242C34] border border-[#2B3540] overflow-hidden">
      <div
        className={`h-full ${colorClass} transition-[width] duration-500 ease-out`}
        style={{ width: `${clamp(valuePct, 0, 100)}%` }}
      />
    </div>
    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 text-xs font-semibold text-white/90">
      {valuePct}%
    </div>
  </div>
);

/* -----------------------------
 Main Mock Component
------------------------------ */
const BibofitMock = () => {
  const targets = useMemo(
    () => ({
      calories: 2200,
      protein: 138,
      carbs: 248,
      fats: 73,
    }),
    []
  );

  const [totals, setTotals] = useState({
    calories: 1027,
    protein: 48,
    carbs: 151,
    fats: 26,
  });

  const [breakfast, setBreakfast] = useState({
    calories: 589,
    protein: 28,
    carbs: 62,
    fats: 26,
  });

  // “Comida” (inventada a partir del resto del día para el mock)
  const lunch = useMemo(() => {
    const c = clamp(totals.calories - breakfast.calories, 0, targets.calories);
    const p = clamp(totals.protein - breakfast.protein, 0, targets.protein);
    const cb = clamp(totals.carbs - breakfast.carbs, 0, targets.carbs);
    const f = clamp(totals.fats - breakfast.fats, 0, targets.fats);
    return { calories: c, protein: p, carbs: cb, fats: f };
  }, [totals, breakfast, targets]);

  const [weightKg, setWeightKg] = useState(84);
  const [daysAgo, setDaysAgo] = useState(11);

  const [selectedDate, setSelectedDate] = useState(() => new Date(2026, 0, 8)); // 8 Ene 2026

  const randomizeDayData = useCallback(() => {
    const calories = randInt(850, 1750);

    const protein = clamp(randInt(35, 130), 0, targets.protein);
    const carbs = clamp(randInt(80, 240), 0, targets.carbs);
    const fats = clamp(randInt(15, 70), 0, targets.fats);

    setTotals({ calories, protein, carbs, fats });

    const bfRatio = randInt(45, 65) / 100;
    const bCalories = clamp(Math.round(calories * bfRatio), 250, 980);
    const bProtein = clamp(Math.round(protein * bfRatio), 10, targets.protein);
    const bCarbs = clamp(Math.round(carbs * bfRatio), 20, targets.carbs);
    const bFats = clamp(Math.round(fats * bfRatio), 5, targets.fats);

    setBreakfast({
      calories: bCalories,
      protein: bProtein,
      carbs: bCarbs,
      fats: bFats,
    });
  }, [targets]);

  const onDayPress = useCallback(
    (date) => {
      setSelectedDate(date);
      randomizeDayData();
    },
    [randomizeDayData]
  );

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(selectedDate, i - 3);
      return {
        date,
        label: dowEs[date.getDay()],
        n: date.getDate(),
        key: date.toISOString().slice(0, 10),
      };
    });
  }, [selectedDate]);

  const selectedDay = useMemo(() => weekDays[3], [weekDays]);

  const onWeightPress = useCallback(() => {
    setWeightKg((w) => w + 1);
    // opcional si quieres que se mueva
    // setDaysAgo((d) => clamp(d + 1, 1, 30));
  }, []);

  const pct = useMemo(() => {
    const proteinPct = Math.round((totals.protein / targets.protein) * 100);
    const carbsPct = Math.round((totals.carbs / targets.carbs) * 100);
    const fatsPct = Math.round((totals.fats / targets.fats) * 100);
    const caloriesPct = Math.round((totals.calories / targets.calories) * 100);
    return {
      proteinPct: clamp(proteinPct, 0, 100),
      carbsPct: clamp(carbsPct, 0, 100),
      fatsPct: clamp(fatsPct, 0, 100),
      caloriesPct: clamp(caloriesPct, 0, 100),
    };
  }, [totals, targets]);

  return (
    <div className="relative rounded-2xl border border-gray-800 bg-[#15191e]/80 backdrop-blur-sm shadow-2xl overflow-hidden">
      {/* Browser Header Mockup */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-[#1a1e23]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
          <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
        </div>
        <div className="flex-1 text-center">
          <div className="inline-block px-3 py-0.5 rounded-full bg-black/30 text-[10px] text-gray-500 font-mono">
            bibofit.com/dashboard
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 sm:p-6 space-y-5 bg-[#0E141B]">
        {/* Top header actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-2xl bg-[#111A22] border border-[#1E2832] p-2">
            <Tap
              className="h-10 w-12 rounded-xl bg-green-500/20 border border-green-500/40 flex items-center justify-center hover:bg-green-500/25 hover:border-green-400/50"
              flashClassName="bg-green-500/30 border-green-300/60"
              onTapAction={() => onDayPress(addDays(selectedDate, -1))}
            >
              <CalendarDays className="h-5 w-5 text-green-400" />
            </Tap>

            <Tap
              className="h-10 w-12 rounded-xl bg-[#16212B] border border-[#23303C] flex items-center justify-center hover:bg-white/5 hover:border-white/20"
              flashClassName="bg-white/10 border-white/25"
              onTapAction={() => randomizeDayData()}
            >
              <Shield className="h-5 w-5 text-white/60" />
            </Tap>

            <Tap
              className="h-10 w-12 rounded-xl bg-[#16212B] border border-[#23303C] flex items-center justify-center hover:bg-white/5 hover:border-white/20"
              flashClassName="bg-white/10 border-white/25"
              onTapAction={() => randomizeDayData()}
            >
              <FileText className="h-5 w-5 text-white/60" />
            </Tap>
          </div>

          <div className="flex items-center gap-5 pr-1">
            <CalendarDays className="h-6 w-6 text-white/55" />
            <ShoppingCart className="h-6 w-6 text-white/55" />
            <User2 className="h-6 w-6 text-white/55" />
          </div>
        </div>

        {/* Week selector */}
        <div className="rounded-3xl bg-[#111A22] border border-[#1E2832] p-0 sm:p-4">
          <div className="flex items-center justify-between">
            <Tap
              className="h-10 w-10 rounded-2xl bg-[#16212B] border border-[#23303C] flex items-center justify-center hover:bg-white/5 hover:border-white/20"
              flashClassName="bg-white/10 border-white/25"
              onTapAction={() => onDayPress(addDays(selectedDate, -1))}
            >
              <ChevronLeft className="h-5 w-5 text-white/60" />
            </Tap>

            <div className="flex items-center gap-0 sm:gap-4">
              {weekDays.slice(0, 3).map((x) => {
                const isSelected = isSameDay(x.date, selectedDate);
                return (
                  <Tap
                    key={x.key}
                    className={`text-center px-2 py-1 rounded-2xl ${isSelected ? 'bg-white/8 border border-white/15' : ''
                      } hover:bg-white/5`}
                    flashClassName="bg-white/10"
                    onTapAction={() => onDayPress(x.date)}
                  >
                    <div className="text-xs font-semibold tracking-wide text-white/55">{x.label}</div>
                    <div className="text-2xl font-bold text-white/85">{x.n}</div>
                  </Tap>
                );
              })}

              <Tap
                className="w-12 sm:w-16 h-[84px] rounded-3xl bg-[#1A2530] border border-[#2A3846] flex flex-col items-center justify-center hover:bg-white/5 hover:border-white/20"
                flashClassName="bg-white/10 border-white/25"
                onTapAction={() => onDayPress(selectedDay.date)}
              >
                <div className="text-xs font-bold text-sky-300 tracking-wide">{selectedDay.label}</div>
                <div className="text-2xl font-extrabold text-white">{selectedDay.n}</div>
                <div className="mt-2 h-2 w-2 rounded-full bg-green-500" />
              </Tap>

              {weekDays.slice(4, 7).map((x) => {
                const isSelected = isSameDay(x.date, selectedDate);
                return (
                  <Tap
                    key={x.key}
                    className={`text-center px-2 py-1 rounded-2xl ${isSelected ? 'bg-white/8 border border-white/15' : ''
                      } hover:bg-white/5`}
                    flashClassName="bg-white/10"
                    onTapAction={() => onDayPress(x.date)}
                  >
                    <div className="text-xs font-semibold tracking-wide text-white/55">{x.label}</div>
                    <div className="text-2xl font-bold text-white/85">{x.n}</div>
                  </Tap>
                );
              })}
            </div>

            <Tap
              className="h-10 w-10 rounded-2xl bg-[#16212B] border border-[#23303C] flex items-center justify-center hover:bg-white/5 hover:border-white/20"
              flashClassName="bg-white/10 border-white/25"
              onTapAction={() => onDayPress(addDays(selectedDate, 1))}
            >
              <ChevronRight className="h-5 w-5 text-white/60" />
            </Tap>
          </div>
        </div>

        {/* Weight card */}
        <div className="rounded-3xl bg-[#111A22] border border-[#1E2832] p-5">
          <Tap
            className="w-full rounded-2xl bg-[#121E28] border border-[#1F2B37] p-5 text-center hover:bg-white/5 hover:border-white/20"
            flashClassName="bg-white/10 border-white/25"
            onTapAction={onWeightPress}
          >
            <div className="flex items-center justify-center gap-2 text-purple-300 font-semibold">
              <Scale className="h-5 w-5" />
              <span>Peso medio estimado</span>
            </div>

            <div className="mt-2 text-3xl font-extrabold text-purple-200">
              <AnimatedNumber value={`${weightKg}`} />{' '}
              <span className="text-2xl font-extrabold">kg</span>
            </div>

          </Tap>
        </div>

        {/* Macros row */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {/* Prote */}
            <div>
              <div className="flex items-center gap-2 text-red-400 font-bold">
                <Drumstick className="h-5 w-5" />
                <span>Proteínas</span>
              </div>
              <div className="mt-2 text-xl font-extrabold text-white">
                <AnimatedNumber value={totals.protein} />
                <span className="text-base font-semibold text-white/55">g</span>
                <span className="text-base font-semibold text-white/35"> / {targets.protein}g</span>
              </div>
              <MacroPill valuePct={pct.proteinPct} colorClass="bg-red-500" label={`${pct.proteinPct}%`} />
            </div>

            {/* Carbs */}
            <div>
              <div className="flex items-center gap-2 text-yellow-400 font-bold">
                <Wheat className="h-5 w-5" />
                <span>Carbohidratos</span>
              </div>
              <div className="mt-2 text-xl font-extrabold text-white">
                <AnimatedNumber value={totals.carbs} />
                <span className="text-base font-semibold text-white/55">g</span>
                <span className="text-base font-semibold text-white/35"> / {targets.carbs}g</span>
              </div>
              <MacroPill valuePct={pct.carbsPct} colorClass="bg-yellow-400" label={`${pct.carbsPct}%`} />
            </div>

            {/* Fats */}
            <div>
              <div className="flex items-center gap-2 text-green-400 font-bold">
                <Droplet className="h-5 w-5" />
                <span>Grasas</span>
              </div>
              <div className="mt-2 text-xl font-extrabold text-white">
                <AnimatedNumber value={totals.fats} />
                <span className="text-base font-semibold text-white/55">g</span>
                <span className="text-base font-semibold text-white/35"> / {targets.fats}g</span>
              </div>
              <MacroPill valuePct={pct.fatsPct} colorClass="bg-green-500" label={`${pct.fatsPct}%`} />
            </div>
          </div>

          {/* Calories */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-orange-400 font-bold text-xl">
                <Flame className="h-6 w-6" />
                <span>Calorías Totales</span>
              </div>
              <div className="text-xl font-extrabold text-white">
                <AnimatedNumber value={totals.calories} />{' '}
                <span className="text-lg font-semibold text-white/45">/ {targets.calories} kcal</span>
              </div>
            </div>
            <LongBar valuePct={pct.caloriesPct} colorClass="bg-orange-500" />
          </div>
        </div>

        {/* Day / Week segmented */}
        <div className="rounded-3xl bg-[#111A22] border border-[#1E2832] p-4">
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#0F171F] border border-[#1E2832] p-2">
            <button
              type="button"
              className="h-12 rounded-2xl bg-[#263240] border border-[#334354] text-white font-semibold flex items-center justify-center gap-2"
            >
              <ListOrdered className="h-5 w-5 text-white/70" />
              Día
            </button>
            <button
              type="button"
              className="h-12 rounded-2xl bg-transparent text-white/60 font-semibold flex items-center justify-center gap-2"
            >
              <CalendarDays className="h-5 w-5 text-white/40" />
              Semana
            </button>
          </div>
        </div>

        {/* Meals header */}
        <div className="flex items-center justify-between pt-1">
          <h3 className="text-2xl font-extrabold text-white">Comidas del día</h3>
          <button
            type="button"
            className="h-12 w-12 rounded-2xl bg-[#111A22] border border-[#1E2832] flex items-center justify-center"
            onClick={randomizeDayData}
          >
            <ShoppingCart className="h-6 w-6 text-sky-300" />
          </button>
        </div>

        {/* Breakfast accordion card */}
        <div className="rounded-3xl bg-[#111A22] border border-[#1E2832] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl font-extrabold text-green-300">Desayunos</div>
              <ChevronDown className="h-5 w-5 text-white/55" />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="h-12 w-12 rounded-2xl bg-[#151E28] border border-[#24303C] flex items-center justify-center"
                onClick={randomizeDayData}
              >
                <Apple className="h-5 w-5 text-orange-300" />
              </button>
              <button
                type="button"
                className="h-12 w-12 rounded-2xl bg-[#151E28] border border-[#24303C] flex items-center justify-center"
                onClick={randomizeDayData}
              >
                <UtensilsCrossed className="h-5 w-5 text-sky-300" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-6 text-lg font-bold">
            <div className="flex items-center gap-2 text-orange-400">
              <Flame className="h-5 w-5" />
              <span>
                <AnimatedNumber value={breakfast.calories} />
              </span>
            </div>
            <div className="flex items-center gap-2 text-red-400">
              <Drumstick className="h-4 w-4" />
              <span>
                <AnimatedNumber value={`${breakfast.protein}g`} />
              </span>
            </div>
            <div className="flex items-center gap-2 text-yellow-400">
              <Wheat className="h-4 w-4" />
              <span>
                <AnimatedNumber value={`${breakfast.carbs}g`} />
              </span>
            </div>
            <div className="flex items-center gap-2 text-green-400">
              <Droplet className="h-4 w-4" />
              <span>
                <AnimatedNumber value={`${breakfast.fats}g`} />
              </span>
            </div>
          </div>
        </div>

        {/* Lunch card */}
        <div className="rounded-3xl bg-[#111A22] border border-[#1E2832] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl font-extrabold text-white/85">Comidas</div>
              <ChevronDown className="h-6 w-6 text-white/55 rotate-180" />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="h-12 w-12 rounded-2xl bg-[#151E28] border border-[#24303C] flex items-center justify-center"
                onClick={randomizeDayData}
              >
                <UtensilsCrossed className="h-6 w-6 text-sky-300" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-6 text-lg font-bold">
            <div className="flex items-center gap-2 text-orange-400">
              <Flame className="h-5 w-5" />
              <span>
                <AnimatedNumber value={lunch.calories} />
              </span>
            </div>
            <div className="flex items-center gap-2 text-red-400">
              <Drumstick className="h-5 w-5" />
              <span>
                <AnimatedNumber value={`${lunch.protein}g`} />
              </span>
            </div>
            <div className="flex items-center gap-2 text-yellow-400">
              <Wheat className="h-5 w-5" />
              <span>
                <AnimatedNumber value={`${lunch.carbs}g`} />
              </span>
            </div>
            <div className="flex items-center gap-2 text-green-400">
              <Droplet className="h-5 w-5" />
              <span>
                <AnimatedNumber value={`${lunch.fats}g`} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -----------------------------
 HERO
------------------------------ */
const HeroSection = () => {
  return (
    <section className="relative pt-32 pb-0 sm:pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-green-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Text Content */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              ¡Nueva Versión de Lanzamiento 1.0!
            </div>

            <h1 className="text-2xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
              La Evolución del Fitness, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">
                descubre la forma más flexible de llevar tu dieta para el día a día.
              </span>
            </h1>

            <p className="text-lg text-gray-400 mb-8 leading-relaxed max-w-xl">
              Bibofit es una plataforma de nutrición diseñada para crear planes personalizados que se adaptan automáticamente a tus decisiones diarias.
              Flexibilidad total, con el control necesario para seguir progresando
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link to="/signup">
                <Button size="lg" className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-emerald-950 font-bold h-12 px-8">
                  Empezar Gratis Ahora
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>

              <Link to="/login">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto border-gray-600 bg-emerald-200/10 text-green-300 hover:bg-green-100/10 hover:text-green-200 h-12 px-8"
                >
                  Ya tengo cuenta
                </Button>
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Sin tarjeta de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Plan gratuito disponible</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Cancela cuando quieras</span>
              </div>
            </div>
          </motion.div>

          {/* Mockup / Visual */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative w-full sm:mx-auto sm:max-w-[520px] lg:mx-0 lg:max-w-none"
          >
            {/* Full-bleed en móvil sin romper el grid/container */}
            <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen sm:left-auto sm:right-auto sm:mx-auto sm:w-full">
              <div className="origin-top mx-auto w-[98%] scale-[0.95]">
                <BibofitMock />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;