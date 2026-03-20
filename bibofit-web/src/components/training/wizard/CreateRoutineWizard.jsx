import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createWeeklyRoutineQuickstartV2 } from '@/lib/training/trainingPlanService';
import { getDayTypeLabel, useCreateRoutineWizard } from '@/hooks/useCreateRoutineWizard';

import StepBasicInfo from './steps/StepBasicInfo';
import StepTrainingDays from './steps/StepTrainingDays';
import StepCalendar from './steps/StepCalendar';
import StepVolumeQuestion from './steps/StepVolumeQuestion';
import StepMuscleTargets from './steps/StepMuscleTargets';
import StepDayEditor from './steps/StepDayEditor';

const STEP_META = {
  'basic-info':       { title: 'Crea tu rutina',                description: 'Dale un nombre y elige el objetivo principal' },
  'training-days':    { title: '¿Cuántos días quieres entrenar?', description: '' },
  'calendar':         { title: 'Distribuye tu semana',           description: 'Elige el tipo de entrenamiento para cada día' },
  'volume-question':  { title: 'Objetivo semanal de volumen',    description: '¿Quieres controlar las series por grupo muscular?' },
  'muscle-targets':   { title: 'Grupos musculares',              description: 'Series semanales objetivo por músculo' },
  'day-editor':       { title: '',                               description: '' },
};

const STEP_COMPONENTS = {
  'basic-info':      StepBasicInfo,
  'training-days':   StepTrainingDays,
  'calendar':        StepCalendar,
  'volume-question': StepVolumeQuestion,
  'muscle-targets':  StepMuscleTargets,
  'day-editor':      StepDayEditor,
};

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

const CreateRoutineWizard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const wizard = useCreateRoutineWizard();
  const {
    currentStepId,
    currentStepIndex,
    totalSteps,
    currentDayIdx,
    setCurrentDayIdx,
    cycleDays,
    dayBlueprint,
    direction,
    goNext,
    goPrev,
    buildSubmitPayload,
    clearDraft,
  } = wizard;

  const handleSubmit = async () => {
    if (!user?.id) return;

    // Validate all days have at least one exercise in the default block
    for (let i = 0; i < dayBlueprint.length; i += 1) {
      const block = dayBlueprint[i]?.blocks?.[0];
      const hasExercise = block?.exercises?.some((e) => e.exercise_id);
      if (!hasExercise) {
        toast({
          title: 'Faltan ejercicios',
          description: `El día ${i + 1} no tiene ningún ejercicio configurado.`,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await createWeeklyRoutineQuickstartV2(buildSubmitPayload(user.id));
      clearDraft();
      toast({
        title: 'Rutina creada',
        description: 'Se creó tu rutina con microciclo activo automático.',
        variant: 'success',
      });
      navigate('/plan/entreno', { replace: true });
    } catch (error) {
      console.error('Error creating routine:', error);
      toast({
        title: 'No se pudo crear la rutina',
        description: error?.message || 'Revisa la configuración e inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Progress bar calculation
  // In day-editor: each day counts as a sub-fraction of the last step
  let progressValue;
  if (currentStepId === 'day-editor') {
    progressValue = ((currentStepIndex + (currentDayIdx + 1) / cycleDays) / totalSteps) * 100;
  } else {
    progressValue = ((currentStepIndex + 1) / totalSteps) * 100;
  }

  const isFirstStep = currentStepIndex === 0;
  const canGoBack = !isFirstStep || (currentStepId === 'day-editor' && currentDayIdx > 0);

  // Dynamic title for day-editor
  const meta = STEP_META[currentStepId];
  const isDayEditor = currentStepId === 'day-editor';
  const dayType = dayBlueprint[currentDayIdx]?.blocks?.[0]?.type || 'custom';

  const StepComponent = STEP_COMPONENTS[currentStepId];

  // The animation key drives re-animation when step or day changes
  const animKey = `${currentStepId}-${currentDayIdx}`;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-64px)] bg-[#0f1115] text-gray-800 dark:text-white">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#0f1115] border-b border-border">
        {/* Top row: back / title / close */}
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={goPrev}
            disabled={!canGoBack}
            className="text-muted-foreground hover:text-foreground disabled:opacity-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <span className="text-sm font-semibold dark:text-white text-gray-950  truncate px-2 max-w-[60%] text-center">
            {isDayEditor
              ? (dayBlueprint[currentDayIdx]?.name || `Día ${currentDayIdx + 1}`)
              : `Paso ${currentStepIndex + 1} de ${totalSteps}`}
          </span>

          <Button
            variant="ghost"
            size="icon"
            asChild
            className="text-muted-foreground hover:text-foreground"
          >
            <Link to="/plan/entreno">
              <X className="h-5 w-5" />
            </Link>
          </Button>
        </div>

        {/* Day tabs — only visible in day-editor */}
        {isDayEditor && (
          <div className="px-4 pb-3">
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${cycleDays}, minmax(0, 1fr))` }}
            >
              {dayBlueprint.map((day, idx) => {
                const type = day.blocks?.[0]?.type || 'custom';
                const isActive = idx === currentDayIdx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentDayIdx(idx)}
                    className={`w-full flex flex-col items-center justify-center rounded-xl px-1 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#F44C40] text-white shadow-sm shadow-[#F44C40]/30'
                        : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                    }`}
                  >
                    <span className={`text-[11px] font-bold ${isActive ? 'text-white' : 'text-foreground/60'}`}>
                      Día {idx + 1}
                    </span>
                    <span className={`text-[9px] mt-0.5 leading-none ${isActive ? 'text-white/80' : 'text-muted-foreground/60'}`}>
                      {getDayTypeLabel(type).split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────── */}
      <div className="shrink-0 h-1 bg-muted w-full overflow-hidden">
        <div
          className="h-full bg-[#F44C40] transition-all duration-400 ease-out"
          style={{ width: `${progressValue}%` }}
        />
      </div>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="flex-1 w-full max-w-2xl mx-auto flex flex-col px-5 py-6 min-h-0">
        {/* Step title (not shown for day-editor — it has its own layout) */}
        {!isDayEditor && (meta.title || meta.description) && (
          <div className="mb-6 shrink-0">
            {meta.title && (
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">{meta.title}</h2>
            )}
            {meta.description && (
              <p className="text-sm text-muted-foreground">{meta.description}</p>
            )}
          </div>
        )}

        {/* Subtitle for day-editor */}
        {isDayEditor && (
          <p className="text-sm text-muted-foreground mb-4 shrink-0">
            Añade los ejercicios para este día
          </p>
        )}

        {/* Animated step */}
        <div className="flex-1 flex flex-col min-h-0">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={animKey}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="flex flex-col flex-1 h-full"
            >
              <StepComponent
                wizard={wizard}
                onNext={goNext}
                onPrev={goPrev}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default CreateRoutineWizard;
