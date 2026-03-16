import React, { useState, useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { InputWithUnit } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  Target,
  History,
  FileType,
  Loader2,
  CircleHelp,
  TrendingDown,
  TrendingUp,
  MinusCircle
} from 'lucide-react';
import DietTypeSelector from '@/components/shared/DietTypeSelector';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import {
  GOAL_DIRECTION_OPTIONS,
  calculateGoalAdjustedCalories,
  findDefaultGoalId,
  resolveGoalAdjustmentRange,
  resolveGoalDirection,
  sanitizeGoalAdjustmentPct
} from '@/lib/dietGoalAdjustment';

const GOAL_DIRECTION_COPY = {
  [GOAL_DIRECTION_OPTIONS.DEFICIT]: {
    label: 'Reducir calorias (deficit)',
    icon: TrendingDown,
    tone: 'text-orange-400'
  },
  [GOAL_DIRECTION_OPTIONS.MAINTENANCE]: {
    label: 'Mantener calorias',
    icon: MinusCircle,
    tone: 'text-blue-400'
  },
  [GOAL_DIRECTION_OPTIONS.SURPLUS]: {
    label: 'Aumentar calorias (superavit)',
    icon: TrendingUp,
    tone: 'text-emerald-400'
  }
};

const INFO_CONTENT = {
  objective: {
    title: 'Objetivo principal',
    description:
      'El objetivo define si tu ingesta parte del mantenimiento y luego se mantiene, se reduce o se incrementa de forma progresiva.'
  },
  adjustment: {
    title: 'Porcentaje de ajuste calorico',
    description:
      'Bibofit aplica el porcentaje sobre tus calorias de mantenimiento (TDEE). Si eliges perdida de grasa, se resta; si eliges ganancia, se suma.'
  },
  guardrails: {
    title: 'Guardarrailes saludables',
    description:
      'Para evitar extremos, Bibofit limita el rango. Deficit: 5% a 25% (recomendado 10% a 20%). Superavit: 3% a 15% (recomendado 5% a 10%).'
  },
  science: {
    title: 'Base cientifica',
    description:
      'Estos rangos se alinean con consensos en nutricion deportiva: ajustes moderados suelen mejorar adherencia y preservar masa libre de grasa frente a estrategias agresivas.'
  }
};

const normalizeNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const parsePositiveInput = (value) => {
  if (value === '') return '';
  const normalized = String(value).replace(',', '.');
  if (!/^\d{0,2}(\.\d{0,2})?$/.test(normalized)) return null;
  return normalized;
};

const InfoIconButton = ({ label, onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Mas informacion sobre ${label}`}
        className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
      >
        <CircleHelp className="h-4 w-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent>{`Mas info: ${label}`}</TooltipContent>
  </Tooltip>
);

const fetchDietGoals = async () => {
  const preferred = await supabase
    .from('diet_goals')
    .select(
      'id, name, description, energy_adjustment_direction, default_adjustment_pct, min_adjustment_pct, max_adjustment_pct'
    )
    .order('name');

  if (!preferred.error) return preferred;

  return supabase
    .from('diet_goals')
    .select('id, name, description')
    .order('name');
};

const fetchDietPreferences = async (userId) => {
  const preferred = await supabase
    .from('diet_preferences')
    .select('diet_goal_id, diet_type_id, diet_history, calorie_adjustment_pct, calorie_adjustment_direction')
    .eq('user_id', userId)
    .maybeSingle();

  if (!preferred.error) return preferred;

  return supabase
    .from('diet_preferences')
    .select('diet_goal_id, diet_type_id, diet_history')
    .eq('user_id', userId)
    .maybeSingle();
};

const DietObjectiveStep = ({ onNext, isLoading }) => {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    diet_goal_id: '',
    diet_history: '',
    diet_type_id: '',
    calorie_adjustment_direction: GOAL_DIRECTION_OPTIONS.MAINTENANCE,
    calorie_adjustment_pct: '0'
  });
  const [dietTypes, setDietTypes] = useState([]);
  const [dietGoals, setDietGoals] = useState([]);
  const [errors, setErrors] = useState({});
  const [loadingData, setLoadingData] = useState(true);
  const [infoModalKey, setInfoModalKey] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const [typesRes, goalsRes, preferencesRes] = await Promise.all([
          supabase.from('diet_types').select('id, name, description, diet_type_food_group_rules(rule_type, food_groups(name))').order('name'),
          fetchDietGoals(),
          fetchDietPreferences(user.id)
        ]);

        if (!mounted) return;

        const loadedGoals = goalsRes.data || [];
        if (typesRes.data) setDietTypes(typesRes.data);
        setDietGoals(loadedGoals);

        const pref = preferencesRes.data || {};
        const defaultGoalId = findDefaultGoalId(loadedGoals);
        const selectedGoalId = pref.diet_goal_id ? String(pref.diet_goal_id) : defaultGoalId || '';
        const selectedGoal = loadedGoals.find((goal) => String(goal.id) === String(selectedGoalId));
        const resolvedDirection = resolveGoalDirection(selectedGoal, pref.calorie_adjustment_direction);
        const sanitizedAdjustment = sanitizeGoalAdjustmentPct({
          goalRow: selectedGoal,
          direction: resolvedDirection,
          adjustmentPct: pref.calorie_adjustment_pct
        });

        setFormData({
          diet_goal_id: selectedGoalId,
          diet_history: pref.diet_history ?? '',
          diet_type_id: pref.diet_type_id != null ? String(pref.diet_type_id) : '',
          calorie_adjustment_direction: resolvedDirection,
          calorie_adjustment_pct: String(sanitizedAdjustment.adjustmentPct)
        });
      } catch (err) {
        console.error('Error loading diet objective data:', err);
      } finally {
        if (mounted) setLoadingData(false);
      }
    };

    if (user?.id) fetchData();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const selectedGoal = useMemo(
    () => dietGoals.find((goal) => String(goal.id) === String(formData.diet_goal_id)) || null,
    [dietGoals, formData.diet_goal_id]
  );

  const resolvedDirection = useMemo(
    () => resolveGoalDirection(selectedGoal, formData.calorie_adjustment_direction),
    [selectedGoal, formData.calorie_adjustment_direction]
  );

  const adjustmentRange = useMemo(
    () => resolveGoalAdjustmentRange({ goalRow: selectedGoal, direction: resolvedDirection }),
    [selectedGoal, resolvedDirection]
  );

  const sanitizedAdjustment = useMemo(
    () =>
      sanitizeGoalAdjustmentPct({
        goalRow: selectedGoal,
        direction: resolvedDirection,
        adjustmentPct: normalizeNullableNumber(formData.calorie_adjustment_pct)
      }),
    [selectedGoal, resolvedDirection, formData.calorie_adjustment_pct]
  );

  const adjustmentPreview = useMemo(
    () =>
      calculateGoalAdjustedCalories({
        tdeeKcal: user?.tdee_kcal,
        sex: user?.sex,
        goalRow: selectedGoal,
        direction: resolvedDirection,
        adjustmentPct: sanitizedAdjustment.adjustmentPct
      }),
    [user?.tdee_kcal, user?.sex, selectedGoal, resolvedDirection, sanitizedAdjustment.adjustmentPct]
  );

  const selectedGoalDescription = useMemo(() => {
    if (!selectedGoal) return '';
    return selectedGoal.description || '';
  }, [selectedGoal]);

  const directionCopy = GOAL_DIRECTION_COPY[resolvedDirection] || GOAL_DIRECTION_COPY[GOAL_DIRECTION_OPTIONS.MAINTENANCE];
  const DirectionIcon = directionCopy.icon;

  const validate = () => {
    const newErrors = {};

    if (!formData.diet_goal_id) {
      newErrors.diet_goal_id = 'El objetivo es obligatorio';
    }

    if (resolvedDirection !== GOAL_DIRECTION_OPTIONS.MAINTENANCE) {
      const parsed = normalizeNullableNumber(formData.calorie_adjustment_pct);
      if (parsed === null) {
        newErrors.calorie_adjustment_pct = 'Introduce un porcentaje valido';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGoalChange = (goalId) => {
    const goal = dietGoals.find((item) => String(item.id) === String(goalId));
    const direction = resolveGoalDirection(goal);
    const nextRange = resolveGoalAdjustmentRange({ goalRow: goal, direction });
    const nextPct = direction === GOAL_DIRECTION_OPTIONS.MAINTENANCE ? 0 : nextRange.defaultPct;

    setFormData((prev) => ({
      ...prev,
      diet_goal_id: goalId,
      calorie_adjustment_direction: direction,
      calorie_adjustment_pct: String(nextPct)
    }));

    setErrors((prev) => ({
      ...prev,
      diet_goal_id: undefined,
      calorie_adjustment_pct: undefined
    }));
  };

  const handlePctInputChange = (value) => {
    const parsed = parsePositiveInput(value);
    if (parsed === null) return;

    setFormData((prev) => ({
      ...prev,
      calorie_adjustment_pct: parsed
    }));
    setErrors((prev) => ({ ...prev, calorie_adjustment_pct: undefined }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) return;

    const safeAdjustment = sanitizeGoalAdjustmentPct({
      goalRow: selectedGoal,
      direction: resolvedDirection,
      adjustmentPct: normalizeNullableNumber(formData.calorie_adjustment_pct)
    });

    onNext({
      diet_goal_id: formData.diet_goal_id,
      diet_history: formData.diet_history,
      diet_type_id: formData.diet_type_id ? Number(formData.diet_type_id) : null,
      calorie_adjustment_direction: resolvedDirection,
      calorie_adjustment_pct: safeAdjustment.adjustmentPct
    });
  };

  if (loadingData) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-green-500" />
      </div>
    );
  }

  const infoModalData = infoModalKey ? INFO_CONTENT[infoModalKey] : null;
  const isOutsideRecommendedRange =
    resolvedDirection !== GOAL_DIRECTION_OPTIONS.MAINTENANCE
    && !adjustmentPreview.insideRecommendedRange;

  return (
    <TooltipProvider delayDuration={150}>
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <div className="flex-1 space-y-6 overflow-y-auto pr-1">
          <div className="space-y-3">
            <Label htmlFor="diet_goal_id" className="text-muted-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-green-500" />
              Objetivo principal
              <InfoIconButton label="objetivo principal" onClick={() => setInfoModalKey('objective')} />
            </Label>
            <Select value={formData.diet_goal_id} onValueChange={handleGoalChange}>
              <SelectTrigger id="diet_goal_id" className="h-12 w-full">
                <SelectValue placeholder="Selecciona un objetivo..." />
              </SelectTrigger>
              <SelectContent>
                {dietGoals.map((goal) => (
                  <SelectItem key={goal.id} value={String(goal.id)}>
                    {goal.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedGoalDescription && (
              <p className="text-xs text-muted-foreground italic">{selectedGoalDescription}</p>
            )}
            {errors.diet_goal_id && (
              <p className="text-red-400 text-sm">{errors.diet_goal_id}</p>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Estrategia calorica para este objetivo</p>
              <div className={`inline-flex items-center gap-2 text-sm font-medium ${directionCopy.tone}`}>
                <DirectionIcon className="w-4 h-4" />
                {directionCopy.label}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="calorie_adjustment_pct" className="text-muted-foreground flex items-center gap-2">
                Porcentaje de ajuste
                <InfoIconButton label="porcentaje de ajuste" onClick={() => setInfoModalKey('adjustment')} />
              </Label>

              {resolvedDirection === GOAL_DIRECTION_OPTIONS.MAINTENANCE ? (
                <div className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-3 text-sm text-blue-200">
                  Mantenimiento usa 0%: se conservan tus calorias de mantenimiento.
                </div>
              ) : (
                <>
                  <Slider
                    value={[sanitizedAdjustment.adjustmentPct]}
                    min={adjustmentRange.hardMinPct}
                    max={adjustmentRange.hardMaxPct}
                    step={0.5}
                    onValueChange={(values) => {
                      const nextValue = values?.[0];
                      if (!Number.isFinite(nextValue)) return;
                      handlePctInputChange(String(nextValue));
                    }}
                  />
                  <InputWithUnit
                    id="calorie_adjustment_pct"
                    type="number"
                    unit="%"
                    min={adjustmentRange.hardMinPct}
                    max={adjustmentRange.hardMaxPct}
                    step="0.5"
                    value={formData.calorie_adjustment_pct}
                    onChange={(event) => handlePctInputChange(event.target.value)}
                  />
                  {errors.calorie_adjustment_pct && (
                    <p className="text-red-400 text-sm">{errors.calorie_adjustment_pct}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Rango recomendado Bibofit: {adjustmentRange.recommendedMinPct}% a {adjustmentRange.recommendedMaxPct}%.
                    Limite de seguridad: {adjustmentRange.hardMinPct}% a {adjustmentRange.hardMaxPct}%.
                  </p>
                  {isOutsideRecommendedRange && (
                    <p className="text-xs text-yellow-300">
                      Estás fuera del rango recomendado. Bibofit sugiere usar un ajuste moderado para mejorar adherencia y progresion.
                    </p>
                  )}
                </>
              )}
            </div>

            {adjustmentPreview.baseTdeeKcal ? (
              <div className="rounded-lg border border-border bg-background/60 p-3 text-sm">
                <p className="text-muted-foreground">
                  Calorias de mantenimiento: <span className="font-semibold text-foreground">~{adjustmentPreview.baseTdeeKcal} kcal</span>
                </p>
                <p className="text-muted-foreground">
                  Objetivo inicial: <span className="font-semibold text-foreground">~{adjustmentPreview.targetCaloriesKcal} kcal</span>
                </p>
                {adjustmentPreview.deltaKcal !== null && (
                  <p className="text-muted-foreground">
                    Diferencia: <span className="font-semibold text-foreground">{adjustmentPreview.deltaKcal > 0 ? '+' : ''}{adjustmentPreview.deltaKcal} kcal</span>
                  </p>
                )}
                {adjustmentPreview.minCaloriesGuardrailApplied && (
                  <p className="text-xs text-yellow-300 mt-2">
                    Guardarrail aplicado: se evita bajar de {adjustmentPreview.minCaloriesGuardrailKcal} kcal/dia.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                El ajuste final se aplicara en cuanto Bibofit tenga tus calorias de mantenimiento calculadas.
              </p>
            )}

            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <InfoIconButton label="base cientifica" onClick={() => setInfoModalKey('science')} />
              Rango basado en consenso de nutricion deportiva para evitar estrategias extremas.
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <InfoIconButton label="guardarrailes saludables" onClick={() => setInfoModalKey('guardrails')} />
              Bibofit prioriza progresion sostenible y ajuste quincenal segun evolucion real.
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-muted-foreground flex items-center gap-2">
              <FileType className="w-4 h-4 text-purple-500" />
              Tipo de dieta preferida
            </Label>
            <DietTypeSelector
              dietTypes={dietTypes}
              value={formData.diet_type_id}
              onChange={(v) => setFormData((prev) => ({ ...prev, diet_type_id: v }))}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="history" className="text-muted-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-blue-500" />
              Historial (Opcional)
            </Label>
            <Textarea
              id="history"
              value={formData.diet_history}
              onChange={(event) => setFormData((prev) => ({ ...prev, diet_history: event.target.value }))}
              className="bf-form-control resize-none min-h-[120px]"
              placeholder="Cuentanos brevemente tu experiencia con dietas anteriores..."
            />
          </div>
        </div>

        <div className="pt-6 mt-auto shrink-0">
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Guardando...
              </>
            ) : (
              'Siguiente'
            )}
          </Button>
        </div>
      </form>

      <Dialog open={Boolean(infoModalData)} onOpenChange={(open) => !open && setInfoModalKey(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{infoModalData?.title}</DialogTitle>
            <DialogDescription>{infoModalData?.description}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

export default DietObjectiveStep;
