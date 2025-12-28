import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Info, Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from '@/lib/utils';
import _ from 'lodash'; 

/* ============================================================
   COMPONENTE SLIDER CON DEGRADADO DINÁMICO
   ============================================================ */
const MacroSlider = React.memo(({ label, colorClass, value, grams, onChange }) => {
  const dynamicGradient = {
    background: `linear-gradient(
            90deg,
            hsl(120, 70%, 50%) 0%,
            hsl(${Math.max(0, 120 - (value || 0) * 1.2)}, 70%, 50%) 100%
        )`
  };

  return (
    <div className="w-full min-w-[100px] flex flex-col gap-1.5">
      <div className="flex justify-between items-end text-xs">
        <span className="text-gray-400 md:hidden font-medium">{label}</span>
        <div className="flex items-baseline gap-1.5 ml-auto">
          <span className={cn("text-lg font-bold tabular-nums leading-none", colorClass)}>
            {value || 0}%
          </span>
          <span className="text-xs text-gray-500 font-medium tabular-nums">
            {grams}g
          </span>
        </div>
      </div>

      <Slider
          value={[value || 0]}
          max={100}
          step={1}
          onValueChange={(vals) => onChange(vals[0])}
          className="py-1 relative macro-slider"
          style={{ "--slider-active-background": dynamicGradient.background }}
      />

    </div>
  );
});

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
const MealRow = React.memo(({ meal, totalGrams, onMealPctChange }) => {
  const proteinGrams = Math.round(totalGrams.protein * ((meal.protein_pct || 0) / 100));
  const carbsGrams = Math.round(totalGrams.carbs * ((meal.carbs_pct || 0) / 100));
  const fatGrams = Math.round(totalGrams.fat * ((meal.fat_pct || 0) / 100));
  const totalCalories = (proteinGrams * 4) + (carbsGrams * 4) + (fatGrams * 9);

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center p-3 rounded-lg bg-gray-900/50 border border-transparent hover:border-gray-700/50 transition-colors">
      <div className="flex justify-between items-center md:block">
        <p className="font-semibold text-white">{meal.day_meal.name}</p>
        <p className="md:hidden text-sm font-numeric text-orange-400">~{totalCalories} kcal</p>
      </div>

      <p className="hidden md:block text-center font-numeric text-orange-400 text-lg font-medium">~{totalCalories}</p>

      <MacroSlider
        label="Proteínas"
        colorClass="text-red-400"
        value={meal.protein_pct}
        grams={proteinGrams}
        onChange={(v) => onMealPctChange(meal.id, 'protein', v)}
      />

      <MacroSlider
        label="Carbohidratos"
        colorClass="text-yellow-400"
        value={meal.carbs_pct}
        grams={carbsGrams}
        onChange={(v) => onMealPctChange(meal.id, 'carbs', v)}
      />

      <MacroSlider
        label="Grasas"
        colorClass="text-green-400"
        value={meal.fat_pct}
        grams={fatGrams}
        onChange={(v) => onMealPctChange(meal.id, 'fat', v)}
      />
    </div>
  );
});

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
    readOnly = false 
}) => {
  const [localMeals, setLocalMeals] = useState([]);
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  // Ref to track previous meals prop for deep comparison to avoid infinite loops
  const prevMealsPropRef = useRef(meals);

  // Robust state synchronization
  useEffect(() => {
    // Check if the content of meals prop has actually changed compared to the last processed prop
    const propHasChanged = !_.isEqual(meals, prevMealsPropRef.current);
    const isInitialLoad = localMeals.length === 0 && meals.length > 0;

    // We update local state if:
    // 1. It's the first load
    // 2. The parent passed NEW data (different from what we saw last time)
    //    This allows parent to reset/update data, but prevents "echo" updates where
    //    we send data to parent -> parent updates state -> passes back same data -> we reset local state
    if (propHasChanged || isInitialLoad) {
        const sortedMeals = [...meals].sort(
            (a, b) => (a.day_meal?.display_order ?? 0) - (b.day_meal?.display_order ?? 0)
        );
        
        // Final check to prevent setting state if it's already identical (react optimization)
        if (!_.isEqual(sortedMeals, localMeals)) {
             setLocalMeals(sortedMeals);
        }
        
        // Update our ref to the current prop value
        prevMealsPropRef.current = meals;
    }
  }, [meals, localMeals]);

  // Handle Auto Expansion
  useEffect(() => {
    if (shouldAutoExpand && meals.length > 0) {
        setOpen(true);
    }
  }, [shouldAutoExpand, meals.length]);

  /* ------------------------
     HANDLER CENTRAL
     ------------------------ */
  const handleMealPctChange = useCallback((mealId, macro, value) => {
    if (readOnly) return;
    setLocalMeals(currentMeals => {
        const adjusted = adjustMacroSequential(currentMeals, macro, mealId, value);
        // If an external handler is provided (e.g., for live preview in AssignDialog), call it.
        // The useEffect above protects us from infinite loops when the parent passes back the updated prop.
        if (onConfigChange) {
            onConfigChange(adjusted);
        }
        return adjusted;
    });
  }, [onConfigChange]);

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
      // We compare logic to original prop to see if save is needed
      // (Mostly relevant for Admin view where onConfigChange is not used)
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

  return (
    <Card className="bg-slate-900/50 border-gray-700 text-white shadow-xl w-full max-w-full box-border">
      <Collapsible open={open} onOpenChange={setOpen} className="w-full">
        <CardHeader className="px-4">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between text-left p-2 rounded-md hover:bg-gray-800/40 transition"
            >
              <div>
                <CardTitle>2. Configuración de Macros por Comida</CardTitle>
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
          <CardContent className="px-0 sm:px-6 pb-4">

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
                    <Button onClick={handleSave} disabled={!canSave || !hasChanges || isSaving}>
                     { isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar
                    </Button>
              </CardFooter>
            )}

          </CardContent>
        </CollapsibleContent>

    

      </Collapsible>
    </Card>
  );
};

export default MealMacroConfiguration;
