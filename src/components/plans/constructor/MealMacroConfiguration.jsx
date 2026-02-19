import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Info, Save, Loader2, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from '@/lib/utils';
import _ from 'lodash'; 
import { useAutoFrameAccess } from '@/hooks/useAutoFrameAccess';
import { Link } from 'react-router-dom';

/* ============================================================
   COMPONENTE SLIDER CON DEGRADADO DINÁMICO
   ============================================================ */
const MacroSlider = React.memo(({ label, colorClass, value, grams, onChange, disabled, onDisabledClick }) => {
  const dynamicGradient = {
    background: disabled 
        ? '#374151' 
        : `linear-gradient(
            90deg,
            hsl(120, 70%, 50%) 0%,
            hsl(${Math.max(0, 120 - (value || 0) * 1.2)}, 70%, 50%) 100%
        )`
  };

  return (
    <div className={cn("w-full min-w-[100px] flex flex-col gap-1.5", disabled && "opacity-50 pointer-events-none")} onClick={disabled ? onDisabledClick : undefined}>
      <div className="flex justify-between items-end text-xs">
        <span className="text-gray-400 md:hidden font-medium">{label}</span>
        <div className="flex items-baseline gap-1.5 ml-auto">
          <span className={cn("text-lg font-bold tabular-nums leading-none", colorClass, disabled && "text-gray-500")}>
            {value || 0}%
          </span>
          <span className="text-xs text-gray-500 font-medium tabular-nums">
            {grams}g
          </span>
        </div>
      </div>

      <div className={cn(disabled && "cursor-not-allowed")}>
          <Slider
              value={[value || 0]}
              max={100}
              step={1}
              onValueChange={(vals) => !disabled && onChange(vals[0])}
              disabled={disabled}
              className={cn("py-1 relative macro-slider", disabled && "pointer-events-none")}
              style={{ "--slider-active-background": dynamicGradient.background }}
          />
      </div>

    </div>
  );
});

MacroSlider.displayName = 'MacroSlider';

/* ============================================================
   FUNCIÓN DE REAJUSTE AUTOMÁTICO (SECUENCIAL)
   ============================================================ */
const adjustMacroSequential = (meals, macro, mealId, newValue) => {
  const updated = meals.map(m => ({ ...m }));
  const meal = updated.find(m => m.id === mealId);
  const mealIndex = updated.findIndex(m => m.id === mealId);

  const oldValue = meal[`${macro}_pct`] || 0;
  const diff = newValue - oldValue;

  if (diff === 0) return updated;

  meal[`${macro}_pct`] = newValue;

  const totalAfter = updated.reduce((sum, m) => sum + (m[`${macro}_pct`] || 0), 0);

  if (totalAfter === 100) return updated;

  const excess = totalAfter - 100;
  let remaining = excess;

  for (let i = mealIndex + 1; i < updated.length && remaining !== 0; i++) {
    const currentValue = updated[i][`${macro}_pct`] || 0;
    const reducible = Math.min(currentValue, remaining);
    updated[i][`${macro}_pct`] = currentValue - reducible;
    remaining -= reducible;
  }

  if (remaining !== 0) {
    for (let i = mealIndex - 1; i >= 0 && remaining !== 0; i--) {
      const currentValue = updated[i][`${macro}_pct`] || 0;
      const reducible = Math.min(currentValue, remaining);
      updated[i][`${macro}_pct`] = currentValue - reducible;
      remaining -= reducible;
    }
  }

  updated.forEach(m => {
    m[`${macro}_pct`] = Math.max(0, Math.min(100, m[`${macro}_pct`]));
  });

  return updated;
};

/* ============================================================
   FILA DE UNA COMIDA
   ============================================================ */
const MealRow = React.memo(({ meal, totalGrams, onMealPctChange, readOnly, disabled, onDisabledClick }) => {
  const proteinGrams = Math.round(totalGrams.protein * ((meal.protein_pct || 0) / 100));
  const carbsGrams = Math.round(totalGrams.carbs * ((meal.carbs_pct || 0) / 100));
  const fatGrams = Math.round(totalGrams.fat * ((meal.fat_pct || 0) / 100));
  const totalCalories = (proteinGrams * 4) + (carbsGrams * 4) + (fatGrams * 9);

  return (
    <div className={cn(
        "grid grid-cols-1 md:grid-cols-5 gap-4 items-center p-3 rounded-lg bg-gray-900/50 border border-transparent hover:border-gray-700/50 transition-colors",
        (readOnly || disabled) && "opacity-75"
    )}>
      <div className="flex justify-between items-center md:block">
        <p className="font-semibold text-white">{meal.day_meal?.name || meal.name || 'Comida'}</p>
        <p className="md:hidden text-sm font-numeric text-orange-400">~{totalCalories} kcal</p>
      </div>

      <p className="hidden md:block text-center font-numeric text-orange-400 text-lg font-medium">~{totalCalories}</p>

      <MacroSlider
        label="Proteínas"
        colorClass="text-red-400"
        value={meal.protein_pct}
        grams={proteinGrams}
        onChange={(v) => onMealPctChange(meal.id, 'protein', v)}
        disabled={readOnly || disabled}
        onDisabledClick={onDisabledClick}
      />

      <MacroSlider
        label="Carbohidratos"
        colorClass="text-yellow-400"
        value={meal.carbs_pct}
        grams={carbsGrams}
        onChange={(v) => onMealPctChange(meal.id, 'carbs', v)}
        disabled={readOnly || disabled}
        onDisabledClick={onDisabledClick}
      />

      <MacroSlider
        label="Grasas"
        colorClass="text-green-400"
        value={meal.fat_pct}
        grams={fatGrams}
        onChange={(v) => onMealPctChange(meal.id, 'fat', v)}
        disabled={readOnly || disabled}
        onDisabledClick={onDisabledClick}
      />
    </div>
  );
});

MealRow.displayName = 'MealRow';

/* ============================================================
   TOTAL - Fixed/Floating component
   ============================================================ */
const TotalRow = React.memo(({ mealTotals, gramTotals, floating = false }) => (
  <div className={cn(
      "grid grid-cols-1 md:grid-cols-5 gap-4 items-center p-3 rounded-lg border-t mt-2 transition-all duration-300",
      floating 
        ? "bg-[#1a1e23] border-gray-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] w-full" 
        : "bg-gray-900/80 border-gray-700"
    )}>
    <span className="font-bold text-lg text-white">TOTAL</span>
    <span />
    <div className="relative flex items-center justify-between bg-gray-800/50 rounded-lg border border-gray-700 px-3 h-10">
      <span className={cn("font-bold text-lg font-numeric", mealTotals.protein_pct !== 100 ? 'text-yellow-400' : 'text-green-400')}>
        {mealTotals.protein_pct}%
      </span>
      <span className="font-medium font-numeric text-red-400 text-sm">{gramTotals.protein}g</span>
    </div>
    <div className="relative flex items-center justify-between bg-gray-800/50 rounded-lg border border-gray-700 px-3 h-10">
      <span className={cn("font-bold text-lg font-numeric", mealTotals.carbs_pct !== 100 ? 'text-yellow-400' : 'text-green-400')}>
        {mealTotals.carbs_pct}%
      </span>
      <span className="font-medium font-numeric text-yellow-400 text-sm">{gramTotals.carbs}g</span>
    </div>
    <div className="relative flex items-center justify-between bg-gray-800/50 rounded-lg border border-gray-700 px-3 h-10">
      <span className={cn("font-bold text-lg font-numeric", mealTotals.fat_pct !== 100 ? 'text-yellow-400' : 'text-green-400')}>
        {mealTotals.fat_pct}%
      </span>
      <span className="font-medium font-numeric text-green-400 text-sm">{gramTotals.fat}g</span>
    </div>
  </div>
));

TotalRow.displayName = 'TotalRow';

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
const MealMacroConfiguration = ({ 
    meals, 
    onSaveConfiguration, 
    effectiveTdee, 
    macrosPct, 
    shouldAutoExpand,
    hideSaveButton = false,
    onConfigChange,
    onChange, // New prop
    readOnly = false,
    forceUnlock = false
}) => {
  const [localMeals, setLocalMeals] = useState([]);
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { canUseAutoFrame, message: autoFrameMessage, link: autoFrameLink } = useAutoFrameAccess();
  
  const prevMealsPropRef = useRef(meals);

  useEffect(() => {
    // Basic deep check to prevent unnecessary updates
    const propHasChanged = !_.isEqual(meals, prevMealsPropRef.current);
    const isInitialLoad = localMeals.length === 0 && meals.length > 0;

    if (propHasChanged || isInitialLoad) {
        
        // 1. Sort meals first
        let sortedMeals = [...meals].sort(
            (a, b) => (a.day_meal?.display_order ?? 0) - (b.day_meal?.display_order ?? 0)
        );

        // 2. CHECK BALANCE
        // If the sum of any macro across all meals is NOT 100, we force a balanced redistribution.
        // This fixes the issue where sliders start at 117% (e.g. 3 meals * 39% default).
        
        const totalP = sortedMeals.reduce((acc, m) => acc + (m.protein_pct || 0), 0);
        const totalC = sortedMeals.reduce((acc, m) => acc + (m.carbs_pct || 0), 0);
        const totalF = sortedMeals.reduce((acc, m) => acc + (m.fat_pct || 0), 0);

        if (totalP !== 100 || totalC !== 100 || totalF !== 100) {
            
            const count = sortedMeals.length;
            if (count > 0) {
                const base = Math.floor(100 / count);
                const remainder = 100 % count;

                sortedMeals = sortedMeals.map((meal, index) => {
                    // Distribute remainder to first few meals
                    const extra = index < remainder ? 1 : 0;
                    const share = base + extra;

                    return {
                        ...meal,
                        // If the incoming value was 0, null or caused imbalance, overwrite it.
                        // We use the balanced share.
                        protein_pct: share,
                        carbs_pct: share,
                        fat_pct: share
                    };
                });
            }
        }
        
        if (!_.isEqual(sortedMeals, localMeals)) {
             setLocalMeals(sortedMeals);
             // Also notify parent of the correction immediately so upstream state is valid
             if (onConfigChange) onConfigChange(sortedMeals);
             if (onChange) onChange(sortedMeals);
        }
        
        prevMealsPropRef.current = meals;
    }
  }, [meals, localMeals, onConfigChange, onChange]);

  useEffect(() => {
    if (shouldAutoExpand && meals.length > 0) {
        setOpen(true);
    }
  }, [shouldAutoExpand, meals.length]);

  const handleDisabledClick = useCallback(() => {
    if (!canUseAutoFrame && !forceUnlock) {
         toast({
            title: "Funcionalidad Premium",
            description: (
                 <div className="flex flex-col gap-2">
                    <span>{autoFrameMessage}</span>
                    <Link to={autoFrameLink} className="text-green-400 underline font-bold">
                        Ver Planes
                    </Link>
                </div>
            ),
            variant: "destructive"
        });
    }
  }, [canUseAutoFrame, autoFrameMessage, autoFrameLink, toast, forceUnlock]);

  /* ------------------------
     HANDLER CENTRAL
     ------------------------ */
  const handleMealPctChange = useCallback((mealId, macro, value) => {
    if (readOnly) return; 

    setLocalMeals(currentMeals => {
        const adjusted = adjustMacroSequential(currentMeals, macro, mealId, value);
        if (onConfigChange) {
            onConfigChange(adjusted);
        }
        if (onChange) {
            onChange(adjusted);
        }
        return adjusted;
    });
  }, [onConfigChange, onChange, readOnly]);

  const totalGrams = useMemo(() => ({
    protein: Math.round((effectiveTdee * (macrosPct.protein / 100)) / 4),
    carbs: Math.round((effectiveTdee * (macrosPct.carbs / 100)) / 4),
    fat: Math.round((effectiveTdee * (macrosPct.fat / 100)) / 9)
  }), [effectiveTdee, macrosPct]);

  const { mealTotals, gramTotals } = useMemo(() => {
    return localMeals.reduce((acc, meal) => {
      const protein_pct = meal.protein_pct || 0;
      const carbs_pct = meal.carbs_pct || 0;
      const fat_pct = meal.fat_pct || 0;

      acc.mealTotals.protein_pct += protein_pct;
      acc.mealTotals.carbs_pct += carbs_pct;
      acc.mealTotals.fat_pct += fat_pct;

      acc.gramTotals.protein += Math.round(totalGrams.protein * (protein_pct / 100));
      acc.gramTotals.carbs += Math.round(totalGrams.carbs * (carbs_pct / 100));
      acc.gramTotals.fat += Math.round(totalGrams.fat * (fat_pct / 100));

      return acc;
    }, {
      mealTotals: { protein_pct: 0, carbs_pct: 0, fat_pct: 0 },
      gramTotals: { protein: 0, carbs: 0, fat: 0 }
    });
  }, [localMeals, totalGrams]);

  const hasChanges = useMemo(() => {
      if (!meals || meals.length === 0) return false;
      return localMeals.some(local => {
          const original = meals.find(m => m.id === local.id);
          if (!original) return false;
          return (
              (local.protein_pct || 0) !== (original.protein_pct || 0) ||
              (local.carbs_pct || 0) !== (original.carbs_pct || 0) ||
              (local.fat_pct || 0) !== (original.fat_pct || 0)
          );
      });
  }, [localMeals, meals]);

  const canSave =
    mealTotals.protein_pct === 100 &&
    mealTotals.carbs_pct === 100 &&
    mealTotals.fat_pct === 100;

  const handleSave = async () => {
    if (readOnly) return;

    if (!canSave) {
      toast({
        title: "Error de validación",
        description: "Asegúrate de que los porcentajes de cada macronutriente suman 100%.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    if(onSaveConfiguration) await onSaveConfiguration(localMeals);
    setIsSaving(false);
  };

  const isInteractive = forceUnlock || canUseAutoFrame;

  return (
    <Card className={cn("bg-slate-900/50 border-gray-700 text-white shadow-xl w-full max-w-full box-border", readOnly && "opacity-80")}>
      <Collapsible open={open} onOpenChange={setOpen} className="w-full">
        <CardHeader className="px-4">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                  "w-full flex items-center justify-between text-left p-2 rounded-md hover:bg-gray-800/40 transition",
                  readOnly && "pointer-events-none"
              )}
            >
              <div>
                <CardTitle className="flex items-center gap-2">
                    2. Configuración de Macros por Comida
                    {(readOnly || !isInteractive) && <Lock className="w-4 h-4 text-gray-500" />}
                </CardTitle>
                <CardDescription className="mt-2">
                  Distribuye los porcentajes de cada macro entre las comidas del día.
                </CardDescription>
              </div>

              <div className="p-2">
                {open ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </div>
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent
          className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
        >
          <CardContent className={cn("px-0 sm:px-6 pb-4", readOnly && "pointer-events-none opacity-50")}>
             
            {!isInteractive && !readOnly && (
                <div className="px-4 mb-4">
                    <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg p-4 flex items-start gap-3">
                         <Lock className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                         <div>
                             <h4 className="text-sm font-bold text-blue-300">Configuración Avanzada Bloqueada</h4>
                             <p className="text-sm text-gray-400 mt-1">
                                 {autoFrameMessage} <Link to={autoFrameLink} className="text-green-400 underline">Ver Planes</Link>
                             </p>
                         </div>
                    </div>
                </div>
            )}

            <div className="hidden md:grid grid-cols-1 md:grid-cols-5 gap-4 px-4 text-sm text-gray-400 font-semibold mb-2 mt-4 uppercase tracking-wider z-10 py-2">
              <span>Comida</span>
              <span className="text-center">Kcal</span>
              <span className="pl-1">Proteínas</span>
              <span className="pl-1">Carbohidratos</span>
              <span className="pl-1">Grasas</span>
            </div>

            <div className="space-y-4 mt-2 px-4">
              {localMeals.map((meal) => (
                <MealRow
                  key={meal.id}
                  meal={meal}
                  totalGrams={totalGrams}
                  onMealPctChange={handleMealPctChange}
                  readOnly={readOnly}
                  disabled={!isInteractive && !readOnly}
                  onDisabledClick={handleDisabledClick}
                />
              ))}
            </div>

            {(mealTotals.protein_pct !== 100 ||
              mealTotals.carbs_pct !== 100 ||
              mealTotals.fat_pct !== 100) && (
                <p className="text-sm text-yellow-400 flex items-center gap-2 mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-md mx-4 mb-4">
                  <Info size={16} />
                  <span>
                    Los porcentajes deben sumar <strong>100%</strong>.
                  </span>
                </p>
              )}

            <div className="mt-4 border border-gray-700 rounded-lg">
              <TotalRow mealTotals={mealTotals} gramTotals={gramTotals} floating={false} />
            </div>

            {!hideSaveButton && !readOnly && (
                <CardFooter className="flex justify-end mt-4 p-4 bg-slate-900/70 border-t border-gray-800 rounded-b-lg">
                    {!isInteractive ? (
                        <div className="text-sm text-gray-400 flex items-center gap-2 italic">
                            <Lock className="w-3 h-3"/> Actualiza a Premium para guardar
                        </div>
                    ) : (
                        <Button onClick={handleSave} disabled={!canSave || !hasChanges || isSaving}>
                        { isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Guardar
                        </Button>
                    )}
              </CardFooter>
            )}

          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

MealMacroConfiguration.displayName = 'MealMacroConfiguration';

export default MealMacroConfiguration;