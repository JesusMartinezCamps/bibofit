import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AppIcon from '@/components/icons/AppIcon';
import { useTheme } from '@/contexts/ThemeContext';
import {
  ArrowRight,
  CheckCircle2,
  CalendarDays,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  X,
  Scale,
  Flame,
  Drumstick,
  Wheat,
  Droplet,
  Apple,
  Leaf,
  Dumbbell,
  UtensilsCrossed,
  ChevronDown,
  ListOrdered,
  Moon,
  Sun,
} from 'lucide-react';

/* -----------------------------
 Helpers
------------------------------ */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const HINT_WAVE_INTERVAL_MS = 6000;
const HINT_WAVE_VISIBLE_MS = 3000;
const HINT_TRANSITION_IN_MS = 900;
const HINT_TRANSITION_OUT_MS = 600;
const HINT_BUTTON_TRANSITION_IN_MS = 900;
const HINT_BUTTON_TRANSITION_OUT_MS = 600;
const TOOLTIP_DURATION_MS = 4400;
const TRAINING_TOOLTIP_DURATION_MS = 4600;

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const dowEs = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
const weekHeaderEs = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

const buildCalendarGrid = (monthDate) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const mondayIndex = (firstDay.getDay() + 6) % 7;
  const gridStart = addDays(firstDay, -mondayIndex);

  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i);
    return {
      date,
      key: date.toISOString().slice(0, 10),
      isCurrentMonth: date >= firstDay && date <= lastDay,
    };
  });
};

/* -----------------------------
 Reusable: Tap + Hover button
------------------------------ */
const Tap = ({
  as: Comp = motion.button,
  className = '',
  flashClassName = '',
  hintPulse = false,
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
      style={{
        transitionProperty: 'box-shadow, filter',
        transitionDuration: `${hintPulse ? HINT_TRANSITION_IN_MS : HINT_TRANSITION_OUT_MS}ms`,
        transitionTimingFunction: 'ease-in-out',
      }}
      className={`transition-[box-shadow,filter] ${
        hintPulse
          ? 'ring-1 ring-emerald-700/55 dark:ring-slate-200/45 border-emerald-800/70 dark:border-slate-200/45 shadow-[0_0_12px_rgba(6,95,70,0.34)] dark:shadow-[0_0_12px_rgba(226,232,240,0.22)]'
          : ''
      } ${className} ${flash ? flashClassName : ''}`}
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
    <div className="h-5 rounded-full bg-slate-200 border border-slate-300 dark:bg-[#242C34] dark:border-[#2B3540] overflow-hidden relative">
      <div
        className={`h-full ${colorClass} transition-[width] duration-500 ease-out`}
        style={{ width: `${clamp(valuePct, 0, 100)}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-900/85 dark:text-white/90">
        {label}
      </div>
    </div>
  </div>
);

const LongBar = ({ valuePct = 47, colorClass = 'bg-orange-500' }) => (
  <div className="mt-3 relative">
    <div className="h-5 rounded-full bg-slate-200 border border-slate-300 dark:bg-[#242C34] dark:border-[#2B3540] overflow-hidden">
      <div
        className={`h-full ${colorClass} transition-[width] duration-500 ease-out`}
        style={{ width: `${clamp(valuePct, 0, 100)}%` }}
      />
    </div>
    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-900/85 dark:text-white/90">
      {valuePct}%
    </div>
  </div>
);

/* -----------------------------
 Main Mock Component
------------------------------ */
const BibofitMock = () => {
  const { isDark, toggleTheme } = useTheme();
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

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [mockScreen, setMockScreen] = useState('calendar');
  const [planViewMode, setPlanViewMode] = useState('day');
  const calendarGridRef = useRef(null);
  const tooltipTimeoutRef = useRef(null);

  const [showWeekDayTooltip, setShowWeekDayTooltip] = useState(false);
  const [showMacroTooltip, setShowMacroTooltip] = useState(false);
  const [showWeekPlannerTooltip, setShowWeekPlannerTooltip] = useState(false);
  const [trainingTooltip, setTrainingTooltip] = useState({ visible: false, x: 0, y: 0 });

  const [activeModal, setActiveModal] = useState(null);
  const [hintPulse, setHintPulse] = useState(false);

  const triggerTooltip = useCallback((setter, duration = TOOLTIP_DURATION_MS) => {
    setter(true);
    window.setTimeout(() => setter(false), duration);
  }, []);

  const showTrainingTooltipNearDay = useCallback((event) => {
    if (!calendarGridRef.current) return;

    const gridRect = calendarGridRef.current.getBoundingClientRect();
    const cellRect = event.currentTarget.getBoundingClientRect();

    const tooltipWidth = 210;
    const xRaw = cellRect.left - gridRect.left + cellRect.width + 8;
    const yRaw = cellRect.top - gridRect.top + cellRect.height / 2 - 18;

    const x = Math.max(10, Math.min(xRaw, gridRect.width - tooltipWidth - 10));
    const y = Math.max(8, Math.min(yRaw, gridRect.height - 42));

    setTrainingTooltip({ visible: true, x, y });

    if (tooltipTimeoutRef.current) window.clearTimeout(tooltipTimeoutRef.current);
    tooltipTimeoutRef.current = window.setTimeout(() => {
      setTrainingTooltip((prev) => ({ ...prev, visible: false }));
    }, TRAINING_TOOLTIP_DURATION_MS);
  }, []);

  const randomizeDayData = useCallback(() => {
    const calories = randInt(850, 1750);
    const protein = clamp(randInt(35, 130), 0, targets.protein);
    const carbs = clamp(randInt(80, 240), 0, targets.carbs);
    const fats = clamp(randInt(15, 70), 0, targets.fats);

    setTotals({ calories, protein, carbs, fats });

    const bfRatio = randInt(45, 65) / 100;
    setBreakfast({
      calories: clamp(Math.round(calories * bfRatio), 250, 980),
      protein: clamp(Math.round(protein * bfRatio), 10, targets.protein),
      carbs: clamp(Math.round(carbs * bfRatio), 20, targets.carbs),
      fats: clamp(Math.round(fats * bfRatio), 5, targets.fats),
    });
  }, [targets]);

  const onDayPress = useCallback(
    (date) => {
      setSelectedDate(date);
      randomizeDayData();
    },
    [randomizeDayData]
  );

  const handleCalendarDaySelect = useCallback(
    (date) => {
      setSelectedDate(date);
      setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      randomizeDayData();
      setMockScreen('plan');
      setPlanViewMode('day');
    },
    [randomizeDayData]
  );

  useEffect(() => {
    let hideTimeoutId = null;
    const intervalId = window.setInterval(() => {
      setHintPulse(true);
      hideTimeoutId = window.setTimeout(() => setHintPulse(false), HINT_WAVE_VISIBLE_MS);
    }, HINT_WAVE_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      if (hideTimeoutId) clearTimeout(hideTimeoutId);
      if (tooltipTimeoutRef.current) window.clearTimeout(tooltipTimeoutRef.current);
    };
  }, []);

  const calendarDays = useMemo(() => buildCalendarGrid(calendarMonth), [calendarMonth]);

  const monthTitle = useMemo(() => {
    const month = calendarMonth.toLocaleString('es-ES', { month: 'long' });
    return `${month.charAt(0).toUpperCase() + month.slice(1)} ${calendarMonth.getFullYear()}`;
  }, [calendarMonth]);

  const getCalendarChips = useCallback((date) => {
    const chips = [];
    const day = date.getDate();

    if (day % 2 === 0) chips.push({ id: 'diet', text: 'Plan', icon: <Leaf className="h-3 w-3 text-green-700 dark:text-green-300" />, className: 'bg-green-500/20 border-green-600/45 text-green-800 dark:text-green-100 dark:border-green-500/40' });
    if (day % 5 === 0) chips.push({ id: 'weight', text: 'Peso', icon: <Scale className="h-3 w-3 text-purple-700 dark:text-purple-200" />, className: 'bg-purple-500/20 border-purple-600/45 text-purple-800 dark:text-purple-100 dark:border-purple-500/35' });
    if (day % 7 === 0) chips.push({ id: 'training', text: 'Ejer..', icon: <Dumbbell className="h-3 w-3 text-red-700 dark:text-red-200" />, className: 'bg-red-500/20 border-red-600/45 text-red-800 dark:text-red-100 dark:border-red-500/35' });

    return chips.slice(0, 2);
  }, []);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(selectedDate, i - 3);
        return {
          date,
          label: dowEs[date.getDay()],
          n: date.getDate(),
          key: date.toISOString().slice(0, 10),
        };
      }),
    [selectedDate]
  );

  const selectedDay = useMemo(() => weekDays[3], [weekDays]);

  const weekPlannedMeals = useMemo(
    () =>
      weekDays.map((day, idx) => ({
        ...day,
        plannedMeals: 2 + ((day.n + idx) % 3),
      })),
    [weekDays]
  );

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

  const clickableHintClass = hintPulse
    ? 'ring-1 ring-emerald-700/55 dark:ring-slate-200/45 border-emerald-800/70 dark:border-slate-200/45 shadow-[0_0_12px_rgba(6,95,70,0.34)] dark:shadow-[0_0_12px_rgba(226,232,240,0.22)]'
    : '';
  const clickableHintStyle = {
    transitionProperty: 'box-shadow, filter',
    transitionDuration: `${hintPulse ? HINT_BUTTON_TRANSITION_IN_MS : HINT_BUTTON_TRANSITION_OUT_MS}ms`,
    transitionTimingFunction: 'ease-in-out',
  };

  const recipeMock = useMemo(
    () => ({
      name: 'Tostadas con Aguacate y Huevo',
      difficulty: 'Fácil',
      time: '12 min',
    }),
    []
  );

  const panelClass = 'bg-white border-slate-800/70 dark:bg-[#12212d] dark:border-[#233645]';
  const controlClass = 'bg-slate-100 border-slate-800/70 dark:bg-[#1a2b38] dark:border-[#2f4658]';
  const tileClass = 'bg-slate-100 border-slate-800/70 dark:bg-[#172a38] dark:border-[#2d4457]';

  return (
    <div className="relative rounded-2xl border border-emerald-500/20 bg-white/95 dark:bg-[#0f1722]/90 backdrop-blur-sm shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
          <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
        </div>
        <div className="flex-1 text-center">
          <div className="inline-block px-3 py-0.5 rounded-full bg-black/30 text-[10px] text-muted-foreground font-mono">
            {mockScreen === 'calendar'
              ? 'bibofit.com/dashboard'
              : `bibofit.com/plan/dieta/${selectedDate.toISOString().slice(0, 10)}`}
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 bg-slate-100 dark:bg-[#0d1620]">
        <AnimatePresence mode="wait" initial={false}>
          {mockScreen === 'calendar' ? (
            <motion.div
              key="calendar-screen"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-green-500">
                  {monthTitle}
                </h3>
                <div className="flex items-center gap-2">
                  <Tap
                    hintPulse={hintPulse}
                    className={`h-10 w-10 rounded-2xl border flex items-center justify-center hover:bg-slate-200/70 dark:hover:bg-white/5 dark:hover:border-white/20 ${controlClass}`}
                    flashClassName="bg-slate-200/60 dark:bg-white/10 border-slate-300 dark:border-white/25"
                    onTapAction={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  >
                    <ChevronLeft className="h-5 w-5 text-slate-700 dark:text-white/60" />
                  </Tap>
                  <Tap
                    hintPulse={hintPulse}
                    className={`h-10 w-10 rounded-2xl border flex items-center justify-center hover:bg-slate-200/70 dark:hover:bg-white/5 dark:hover:border-white/20 ${controlClass}`}
                    flashClassName="bg-slate-200/60 dark:bg-white/10 border-slate-300 dark:border-white/25"
                    onTapAction={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  >
                    <ChevronRight className="h-5 w-5 text-slate-700 dark:text-white/60" />
                  </Tap>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    style={clickableHintStyle}
                    className={`h-10 px-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold text-slate-700 dark:text-white/90 hover:bg-slate-200/70 dark:hover:bg-white/5 ${controlClass} ${clickableHintClass}`}
                  >
                    {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    {isDark ? 'Claro' : 'Oscuro'}
                  </button>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-white/60">Selecciona un día para abrir el plan de dieta.</p>

              <div className="grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-wide text-slate-500 dark:text-white/50">
                {weekHeaderEs.map((label) => (
                  <div key={label} className="py-1">{label}</div>
                ))}
              </div>

              <div ref={calendarGridRef} className="relative grid grid-cols-7 gap-2">
                {calendarDays.map(({ date, key, isCurrentMonth }) => {
                  const isToday = isSameDay(date, new Date());
                  const isSelected = isSameDay(date, selectedDate);
                  const chips = getCalendarChips(date);
                  const hasTrainingChip = chips.some((chip) => chip.id === 'training');

                  return (
                    <Tap
                      hintPulse={hintPulse}
                      key={key}
                      className={`min-h-[86px] rounded-2xl border p-2 text-left flex flex-col ${
                        isCurrentMonth
                          ? 'bg-white border-slate-800/60 hover:border-emerald-500/40 dark:bg-[#12212d] dark:border-[#233645]'
                          : 'bg-slate-100 border-slate-700/50 text-slate-600 hover:border-slate-700 dark:bg-[#101923] dark:border-[#1d2a36] dark:text-white/45 dark:hover:border-[#2a3b4a]'
                      } ${isSelected ? 'ring-1 ring-emerald-400/60 border-emerald-500/45' : ''}`}
                      flashClassName="bg-slate-200/60 dark:bg-white/10 border-slate-300 dark:border-white/25"
                      onTapAction={(e) => {
                        if (hasTrainingChip) {
                          showTrainingTooltipNearDay(e);
                          return;
                        }
                        handleCalendarDaySelect(date);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                            isToday ? 'bg-emerald-500/25 text-emerald-900 dark:text-emerald-100 border border-emerald-500/45' : 'text-slate-600 dark:text-white/75'
                          }`}
                        >
                          {date.getDate()}
                        </span>
                        {isSelected && <div className="h-2 w-2 rounded-full bg-emerald-400" />}
                      </div>

                      <div className="mt-1 space-y-1">
                        {chips.map((chip) => (
                          <div
                            key={`${key}-${chip.id}`}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${chip.className}`}
                          >
                            {chip.icon}
                            {chip.text}
                          </div>
                        ))}
                      </div>
                    </Tap>
                  );
                })}
                <AnimatePresence>
                  {trainingTooltip.visible && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      style={{ left: `${trainingTooltip.x}px`, top: `${trainingTooltip.y}px` }}
                      className="absolute z-30 w-[220px] rounded-xl border border-amber-500/40 bg-[#3c2d0f]/95 px-3 py-2 text-base font-medium leading-relaxed text-amber-100 shadow-lg"
                    >
                      Próximamente...
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="plan-screen"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-2 rounded-2xl border p-2 ${panelClass}`}>
                  <Tap
                    hintPulse={hintPulse}
                    className={`h-10 px-3 rounded-xl border flex items-center justify-center gap-2 hover:bg-slate-200/70 dark:hover:bg-white/5 dark:hover:border-white/20 ${controlClass}`}
                    flashClassName="bg-slate-200/60 dark:bg-white/10 border-slate-300 dark:border-white/25"
                    onTapAction={() => setMockScreen('calendar')}
                  >
                    <AppIcon className="h-4 w-4 text-slate-700 dark:text-white/85" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Bibofit</span>
                  </Tap>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    style={clickableHintStyle}
                    className={`h-9 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold text-slate-700 dark:text-white/90 hover:bg-slate-200/70 dark:hover:bg-white/5 ${controlClass} ${clickableHintClass}`}
                  >
                    {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    {isDark ? 'Claro' : 'Oscuro'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal('shopping')}
                    style={clickableHintStyle}
                    className={`h-9 w-9 rounded-xl border flex items-center justify-center text-slate-700 dark:text-white/70 hover:bg-slate-200/70 dark:hover:bg-white/5 ${controlClass} ${clickableHintClass}`}
                  >
                    <ShoppingCart className="h-5 w-5 text-slate-700 dark:text-white/80" />
                  </button>
                </div>
              </div>

              <div className={`relative rounded-3xl border p-0 sm:p-4 ${panelClass}`}>
                <div className="flex items-center justify-between">
                  <Tap
                    hintPulse={hintPulse}
                    className={`h-10 w-10 rounded-2xl border flex items-center justify-center hover:bg-slate-200/70 dark:hover:bg-white/5 dark:hover:border-white/20 ${controlClass}`}
                    flashClassName="bg-slate-200/60 dark:bg-white/10 border-slate-300 dark:border-white/25"
                    onTapAction={() => onDayPress(addDays(selectedDate, -1))}
                  >
                    <ChevronLeft className="h-5 w-5 text-slate-700 dark:text-white/60" />
                  </Tap>

                  <div className="flex items-center gap-0 sm:gap-4">
                    {weekDays.slice(0, 3).map((x) => {
                      const isSelected = isSameDay(x.date, selectedDate);
                      return (
                        <Tap
                          hintPulse={hintPulse}
                          key={x.key}
                          className={`text-center px-2 py-1 rounded-2xl ${isSelected ? 'bg-emerald-100 border border-emerald-300 dark:bg-white/8 dark:border-white/15' : ''} hover:bg-slate-200/70 dark:hover:bg-white/5`}
                          flashClassName="bg-slate-200/60 dark:bg-white/10"
                          onTapAction={() => {
                            onDayPress(x.date);
                            triggerTooltip(setShowWeekDayTooltip);
                          }}
                        >
                          <div className="text-xs font-semibold tracking-wide text-slate-500 dark:text-white/55">{x.label}</div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white/85">{x.n}</div>
                        </Tap>
                      );
                    })}

                    <Tap
                      hintPulse={hintPulse}
                      className="w-12 sm:w-16 h-[84px] rounded-3xl bg-emerald-100 border border-emerald-300 dark:bg-[#1d2f3f] dark:border-[#34566c] flex flex-col items-center justify-center hover:bg-emerald-100/80 dark:hover:bg-white/5 dark:hover:border-white/20"
                      flashClassName="bg-slate-200/60 dark:bg-white/10 border-slate-300 dark:border-white/25"
                      onTapAction={() => {
                        onDayPress(selectedDay.date);
                        triggerTooltip(setShowWeekDayTooltip);
                      }}
                    >
                      <div className="text-xs font-bold text-sky-700 dark:text-sky-300 tracking-wide">{selectedDay.label}</div>
                      <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{selectedDay.n}</div>
                      <div className="mt-2 h-2 w-2 rounded-full bg-green-500" />
                    </Tap>

                    {weekDays.slice(4, 7).map((x) => {
                      const isSelected = isSameDay(x.date, selectedDate);
                      return (
                        <Tap
                          hintPulse={hintPulse}
                          key={x.key}
                          className={`text-center px-2 py-1 rounded-2xl ${isSelected ? 'bg-emerald-100 border border-emerald-300 dark:bg-white/8 dark:border-white/15' : ''} hover:bg-slate-200/70 dark:hover:bg-white/5`}
                          flashClassName="bg-slate-200/60 dark:bg-white/10"
                          onTapAction={() => {
                            onDayPress(x.date);
                            triggerTooltip(setShowWeekDayTooltip);
                          }}
                        >
                          <div className="text-xs font-semibold tracking-wide text-slate-500 dark:text-white/55">{x.label}</div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white/85">{x.n}</div>
                        </Tap>
                      );
                    })}
                  </div>

                  <Tap
                    hintPulse={hintPulse}
                    className={`h-10 w-10 rounded-2xl border flex items-center justify-center hover:bg-slate-200/70 dark:hover:bg-white/5 dark:hover:border-white/20 ${controlClass}`}
                    flashClassName="bg-slate-200/60 dark:bg-white/10 border-slate-300 dark:border-white/25"
                    onTapAction={() => onDayPress(addDays(selectedDate, 1))}
                  >
                    <ChevronRight className="h-5 w-5 text-slate-700 dark:text-white/60" />
                  </Tap>
                </div>

                <AnimatePresence>
                  {showWeekDayTooltip && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="absolute left-4 right-4 bottom-3 z-20 rounded-xl border border-emerald-500/35 bg-[#123326]/95 px-4 py-3 text-base leading-relaxed text-center font-semibold text-emerald-100 shadow-lg"
                    >
                      Puedes cambiar de día rápidamente.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Tap
                hintPulse={hintPulse}
                className={`w-full rounded-3xl border p-5 text-center hover:bg-slate-200/70 dark:hover:bg-white/5 dark:hover:border-white/20 ${panelClass}`}
                flashClassName="bg-slate-200/60 dark:bg-white/10 border-slate-300 dark:border-white/25"
                onTapAction={() => setActiveModal('weight')}
              >
                <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold">
                  <Scale className="h-5 w-5" />
                  <span>Peso medio estimado</span>
                </div>
                <div className="mt-2 text-3xl font-extrabold text-emerald-700 dark:text-emerald-100">
                  72.4 <span className="text-2xl font-extrabold">kg</span>
                </div>
              </Tap>

              <div className="relative">
                <Tap
                  hintPulse={hintPulse}
                  className={`w-full rounded-3xl border p-5 text-left hover:bg-slate-200/70 dark:hover:bg-white/5 dark:hover:border-white/20 ${panelClass}`}
                  flashClassName="bg-slate-200/60 dark:bg-white/10 border-slate-300 dark:border-white/25"
                  onTapAction={() => triggerTooltip(setShowMacroTooltip)}
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-red-400 font-bold">
                          <Drumstick className="h-5 w-5" />
                          <span>Proteínas</span>
                        </div>
                        <div className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
                          <AnimatedNumber value={totals.protein} />
                          <span className="text-base font-semibold text-slate-600 dark:text-white/55">g</span>
                          <span className="text-base font-semibold text-slate-400 dark:text-white/35"> / {targets.protein}g</span>
                        </div>
                        <MacroPill valuePct={pct.proteinPct} colorClass="bg-red-500" label={`${pct.proteinPct}%`} />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 text-yellow-400 font-bold">
                          <Wheat className="h-5 w-5" />
                          <span>Carbohidratos</span>
                        </div>
                        <div className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
                          <AnimatedNumber value={totals.carbs} />
                          <span className="text-base font-semibold text-slate-600 dark:text-white/55">g</span>
                          <span className="text-base font-semibold text-slate-400 dark:text-white/35"> / {targets.carbs}g</span>
                        </div>
                        <MacroPill valuePct={pct.carbsPct} colorClass="bg-yellow-400" label={`${pct.carbsPct}%`} />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 text-green-400 font-bold">
                          <Droplet className="h-5 w-5" />
                          <span>Grasas</span>
                        </div>
                        <div className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
                          <AnimatedNumber value={totals.fats} />
                          <span className="text-base font-semibold text-slate-600 dark:text-white/55">g</span>
                          <span className="text-base font-semibold text-slate-400 dark:text-white/35"> / {targets.fats}g</span>
                        </div>
                        <MacroPill valuePct={pct.fatsPct} colorClass="bg-green-500" label={`${pct.fatsPct}%`} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-orange-400 font-bold text-xl">
                          <Flame className="h-6 w-6" />
                          <span>Calorías Totales</span>
                        </div>
                        <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                          <AnimatedNumber value={totals.calories} />{' '}
                          <span className="text-lg font-semibold text-slate-500 dark:text-white/45">/ {targets.calories} kcal</span>
                        </div>
                      </div>
                      <LongBar valuePct={pct.caloriesPct} colorClass="bg-orange-500" />
                    </div>
                  </div>
                </Tap>

                <AnimatePresence>
                  {showMacroTooltip && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="absolute left-5 right-5 bottom-3 z-20 rounded-xl border border-amber-500/40 bg-[#3c2d0f]/95 px-4 py-3 text-base leading-relaxed text-center font-semibold text-amber-100"
                    >
                      Se lleva un registro de tus calorías para
                      {' '}equilibrarte la dieta y mantener
                      {' '}
                      tu plan siempre compensado.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className={`rounded-3xl border p-4 ${panelClass}`}>
                <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-100 border border-slate-800/70 dark:bg-[#10202d] dark:border-[#233645] p-2">
                  <button
                    type="button"
                    onClick={() => setPlanViewMode('day')}
                    style={clickableHintStyle}
                    className={`h-12 rounded-2xl border transition-colors duration-150 text-slate-900 dark:text-white font-semibold flex items-center justify-center gap-2 ${
                      planViewMode === 'day'
                        ? 'bg-emerald-100 border-emerald-300 dark:bg-[#1f3a4d] dark:border-[#35566e]'
                        : 'bg-transparent border-transparent text-slate-500 dark:text-white/60'
                    } ${clickableHintClass}`}
                  >
                    <ListOrdered className="h-5 w-5 text-slate-600 dark:text-white/70" />
                    Día
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanViewMode('week')}
                    style={clickableHintStyle}
                    className={`h-12 rounded-2xl border transition-colors duration-150 text-slate-900 dark:text-white font-semibold flex items-center justify-center gap-2 ${
                      planViewMode === 'week'
                        ? 'bg-emerald-100 border-emerald-300 dark:bg-[#1f3a4d] dark:border-[#35566e]'
                        : 'bg-transparent border-transparent text-slate-500 dark:text-white/60'
                    } ${clickableHintClass}`}
                  >
                    <CalendarDays className="h-5 w-5 text-slate-500 dark:text-white/40" />
                    Semana
                  </button>
                </div>
              </div>

              {planViewMode === 'week' ? (
                <div className={`relative rounded-3xl border p-5 ${panelClass}`}>
                  <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-4">Planificador de semana</h3>
                  <div className="grid grid-cols-7 gap-2">
                    {weekPlannedMeals.map((day) => (
                      <Tap
                        hintPulse={hintPulse}
                        key={`week-${day.key}`}
                        className={`rounded-2xl border p-2 text-center hover:bg-slate-200/70 dark:hover:bg-white/5 dark:hover:border-white/25 ${tileClass}`}
                        flashClassName="bg-slate-200/60 dark:bg-white/10 border-slate-300 dark:border-white/25"
                        onTapAction={() => triggerTooltip(setShowWeekPlannerTooltip)}
                      >
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-white/55">{day.label}</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{day.n}</div>
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-200/90">{day.plannedMeals} comidas</div>
                      </Tap>
                    ))}
                  </div>
                  <AnimatePresence>
                    {showWeekPlannerTooltip && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                      className="absolute left-4 right-4 bottom-3 z-20 rounded-xl border border-emerald-500/35 bg-[#123326]/95 px-4 py-3 text-base leading-relaxed text-center font-semibold text-emerald-100"
                    >
                        Planifica tus próximas comidas. Bibofit se encarga de
                        {' '}hacerte la vida más fácil para actualizar
                        {' '}
                        tu Lista de la Compra.
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between pt-1">
                    <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">Comidas del día</h3>
                    <button
                      type="button"
                      style={clickableHintStyle}
                      className={`h-12 w-12 rounded-2xl border flex items-center justify-center ${panelClass} ${clickableHintClass}`}
                      onClick={() => setActiveModal('shopping')}
                    >
                      <ShoppingCart className="h-6 w-6 text-sky-700 dark:text-sky-300" />
                    </button>
                  </div>

                  <div className={`rounded-3xl border p-6 ${panelClass}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-extrabold text-green-700 dark:text-green-300">Desayunos</div>
                        <ChevronDown className="h-5 w-5 text-slate-600 dark:text-white/55" />
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          style={clickableHintStyle}
                          className={`h-12 w-12 rounded-2xl border flex items-center justify-center ${tileClass} ${clickableHintClass}`}
                          onClick={() => setActiveModal('snack')}
                        >
                          <Apple className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                        </button>
                        <button
                          type="button"
                          style={clickableHintStyle}
                          className={`h-12 w-12 rounded-2xl border flex items-center justify-center ${tileClass} ${clickableHintClass}`}
                          onClick={() => setActiveModal('recipes')}
                        >
                          <UtensilsCrossed className="h-5 w-5 text-sky-700 dark:text-sky-300" />
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

                    <Tap
                      hintPulse={hintPulse}
                      className={`mt-5 w-full rounded-2xl border p-4 text-left hover:bg-slate-200/70 dark:hover:bg-white/5 dark:hover:border-white/25 ${tileClass}`}
                      flashClassName="bg-slate-200/60 dark:bg-white/10 border-slate-300 dark:border-white/25"
                      onTapAction={() => setActiveModal('recipeView')}
                    >
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{recipeMock.name}</p>
                      <div className="mt-1 flex items-center gap-4 text-sm text-slate-600 dark:text-white/65">
                        <span>Dificultad: {recipeMock.difficulty}</span>
                        <span>Tiempo: {recipeMock.time}</span>
                      </div>
                    </Tap>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveModal(null)}
            className="absolute inset-0 z-30 bg-slate-900/45 dark:bg-[#071018]/80 backdrop-blur-[2px] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-slate-800/70 dark:border-[#2f4658] bg-white dark:bg-[#12212d] p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  {activeModal === 'weight' && (
                    <>
                      <h4 className="text-2xl font-bold text-slate-900 dark:text-white">Registro de Peso</h4>
                      <p className="text-lg font-medium text-slate-600 dark:text-white/75">
                        {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                    </>
                  )}
                  {activeModal === 'shopping' && (
                    <>
                      <h4 className="text-2xl font-bold text-slate-900 dark:text-white">Lista de la Compra</h4>
                      <p className="text-lg font-medium text-slate-600 dark:text-white/75">
                        Una potente lista de la compra, que te hace un recuento de las cantidades de los alimentos y te permite modificarla de forma privada con lo que necesites.
                      </p>
                    </>
                  )}
                  {activeModal === 'snack' && <h4 className="text-2xl font-bold text-slate-900 dark:text-white">Añadir Picoteos</h4>}
                  {activeModal === 'recipes' && <h4 className="text-2xl font-bold text-slate-900 dark:text-white">Añadir Recetas</h4>}
                  {activeModal === 'recipeView' && <h4 className="text-2xl font-bold text-slate-900 dark:text-white">Receta</h4>}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={clickableHintStyle}
                  className={`h-9 w-9 rounded-xl border border-slate-800/70 dark:border-[#2f4658] bg-slate-100 dark:bg-[#1a2b38] text-slate-700 dark:text-white/70 flex items-center justify-center hover:bg-slate-200/70 dark:hover:bg-white/5 ${clickableHintClass}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {activeModal === 'weight' && (
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-5 text-center space-y-4">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-violet-300" />
                  <p className="text-4xl font-light text-slate-900 dark:text-white">
                    72.4 <span className="text-2xl text-slate-600 dark:text-white/70">kg</span>
                  </p>
                  <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/20 px-4 py-2 text-base font-semibold text-violet-700 dark:text-violet-100">
                    Estado de saciedad: <strong>Saciado</strong>
                  </div>
                </div>
              )}

              {activeModal === 'shopping' && (
                <div className="rounded-xl border border-slate-800/70 dark:border-[#2f4658] bg-slate-50 dark:bg-[#0f1b26] p-6 text-center">
                  <p className="text-xl leading-relaxed text-slate-800 dark:text-white/90">
                    Una potente lista de la compra, que te hace un recuento de las cantidades de los alimentos y te permite modificarla de forma privada con lo que necesites.
                  </p>
                </div>
              )}

              {activeModal === 'snack' && (
                <div className="rounded-xl border border-slate-800/70 dark:border-[#2f4658] bg-slate-50 dark:bg-[#0f1b26] p-5 text-lg text-slate-800 dark:text-white/90 leading-relaxed">
                  Añade lo que has picoteado entre horas y dile a Bibofit que te ajuste alguna próxima comida, no te castiga por salirte del plan sino que te ayuda a que siempre puedas volver.
                </div>
              )}

              {activeModal === 'recipes' && (
                <div className="rounded-xl border border-slate-800/70 dark:border-[#2f4658] bg-slate-50 dark:bg-[#0f1b26] p-5 text-lg text-slate-800 dark:text-white/90 leading-relaxed">
                  Añade tus recetas favoritas, Bibofit se encargará de ajustar las cantidades para que se ajusten a tus necesidades.
                </div>
              )}

              {activeModal === 'recipeView' && (
                <div className="rounded-xl border border-slate-800/70 dark:border-[#2f4658] bg-slate-50 dark:bg-[#0f1b26] p-5 text-lg text-slate-800 dark:text-white/90 leading-relaxed">
                  Aquí puedes ver la preparación, alimentos y cantidades de cada receta y modificarlos a tu estilo.
                  ¡Todo lo puedes personalizar a tu gusto en la cocina!
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* -----------------------------
 HERO
------------------------------ */
const HeroSection = () => {
  return (
    <section className="relative pt-32 pb-0 sm:pb-12 lg:pt-48 lg:pb-12 overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-green-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-teal-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-start">
          {/* Text Content */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              ¡Lanzamiento Versión Beta 1.0!
            </div>

            <h1 className="text-2xl lg:text-6xl font-extrabold text-foreground leading-tight mb-6">
              Lleva a un "Dietista Digital" siempre en tu bolsillo, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-300 dark:to-emerald-400">
                con la app que adapta la dieta a ti, no al revés.
              </span>
            </h1>

            <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-xl">
              ¿Lo peor de seguir una dieta? Sentir que ya no puedes disfrutar de la comida.
              Bibofit está diseñada para que se adapte a ti, máxima flexibilidad en las recetas mientras te mantienes siempre sobre el plan.
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
                  className="w-full sm:w-auto border-input bg-background/60 text-foreground hover:bg-muted h-12 px-8"
                >
                  Iniciar Sesión
                </Button>
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 text-sm text-muted-foreground">
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
            <div className="mx-auto w-full flex justify-center">
              <div className="inline-block origin-top scale-[0.80]">
                <div className="w-[560px] max-w-[92vw]">
                  <BibofitMock />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
