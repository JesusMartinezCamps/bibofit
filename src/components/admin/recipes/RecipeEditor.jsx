import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, PlusCircle, Utensils } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import CreateFoodForm from '@/components/admin/recipes/CreateFoodForm';
import RecipeForm from '@/components/admin/recipes/RecipeForm';
import IngredientRow from '@/components/admin/recipes/IngredientRow';
import RecipeListContainer from '@/components/admin/recipes/RecipeListContainer';
import { useAuth } from '@/contexts/AuthContext';
import { Label } from '@/components/ui/label';
import { fetchRecipeData, calculateMacros, getRecipeNutrients, getAvailableFoods } from './RecipeFormUtils';
import { createRecipeHandlers } from './RecipeFormHandlers';
import { saveRecipeMacros } from '@/lib/macroCalculator';
import CheckboxGrid from '@/components/profile/CheckboxGrid';

const macroGridStyle = { gridTemplateColumns: 'minmax(150px, 1fr) 90px 60px 90px 70px 70px 70px 40px' };

const RecipeEditor = ({ 
  recipeToEdit, 
  onSave, 
  isAdminView = false, 
  dietPlanRecipeId = null, 
  userId = null,
  allFoods: allFoodsProp,
  allVitamins: allVitaminsProp,
  allMinerals: allMineralsProp,
  initialMealName = ''
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [formData, setFormData] = useState({ name: '', prep_time_min: '', difficulty: 'Fácil', instructions: '' });
  const [ingredients, setIngredients] = useState([{ local_id: Date.now(), food_id: '', quantity: '' }]);
  const [mealName, setMealName] = useState('');
  const [selectedSensitivities, setSelectedSensitivities] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [currentMacros, setCurrentMacros] = useState({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
  
  const [allFoods, setAllFoods] = useState([]);
  const [allVitamins, setAllVitamins] = useState([]);
  const [allMinerals, setAllMinerals] = useState([]);
  const [allSensitivities, setAllSensitivities] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ingredientView, setIngredientView] = useState('macros');
  const [isCreateFoodOpen, setIsCreateFoodOpen] = useState(false);

  const resetForm = useCallback(() => {
    setFormData({ name: '', prep_time_min: '', difficulty: 'Fácil', instructions: '' });
    setIngredients([{ local_id: Date.now(), food_id: '', quantity: '' }]);
    setMealName('');
    setSelectedSensitivities([]);
    setCurrentMacros({ calories: 0, proteins: 0, carbs: 0, fats: 0 });
  }, []);

  const fetchInitialData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const data = await fetchRecipeData(toast);
      setAllFoods(data.allFoods);
      setAllVitamins(data.allVitamins);
      setAllMinerals(data.allMinerals);
      setAllSensitivities(data.allSensitivities);
    } catch (error) {
      // Error already handled in fetchRecipeData
    } finally {
      setIsLoadingData(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (allFoodsProp) {
        setAllFoods(allFoodsProp);
        setAllVitamins(allVitaminsProp);
        setAllMinerals(allMineralsProp);
        setIsLoadingData(false);
    } else {
        fetchInitialData();
    }
  }, [allFoodsProp, allVitaminsProp, allMineralsProp, fetchInitialData]);

  useEffect(() => {
    if (recipeToEdit) {
      setFormData({
        name: recipeToEdit.name || '',
        prep_time_min: recipeToEdit.prep_time_min || '',
        difficulty: recipeToEdit.difficulty || 'Fácil',
        instructions: recipeToEdit.instructions || '',
      });
      const recipeIngredients = recipeToEdit.ingredients?.map((ing, i) => ({ local_id: `${ing.food_id}-${i}`, food_id: String(ing.food_id), quantity: ing.grams ?? '' })) || [];
      setIngredients(recipeIngredients.length > 0 ? recipeIngredients : [{ local_id: Date.now(), food_id: '', quantity: '' }]);
      setSelectedSensitivities(recipeToEdit.avoided_sensitivities?.map(a => a.id) || []);
      if (dietPlanRecipeId) {
        setMealName(initialMealName);
      }
    } else {
      resetForm();
    }
  }, [recipeToEdit, resetForm, dietPlanRecipeId, initialMealName]);

  const totalMacros = useMemo(() => {
    return ingredients.reduce((totals, ing) => {
      const macros = calculateMacros(ing, allFoods);
      totals.p += macros.p;
      totals.c += macros.c;
      totals.f += macros.f;
      totals.k += macros.k;
      return totals;
    }, { p: 0, c: 0, f: 0, k: 0 });
  }, [ingredients, allFoods]);

  useEffect(() => {
    setCurrentMacros({
      calories: totalMacros.k,
      proteins: totalMacros.p,
      carbs: totalMacros.c,
      fats: totalMacros.f
    });
  }, [totalMacros]);

  const recipeNutrients = useMemo(() => getRecipeNutrients(ingredients, allFoods), [ingredients, allFoods]);

  const availableFoods = useMemo(() => getAvailableFoods(allFoods, selectedSensitivities), [allFoods, selectedSensitivities]);

  const handlers = createRecipeHandlers(
    formData, setFormData,
    ingredients, setIngredients,
    selectedSensitivities, setSelectedSensitivities,
    selectedRecipe, setSelectedRecipe,
    resetForm, toast
  );
  
  const handleFoodCreated = useCallback(async () => {
    setIsCreateFoodOpen(false);
    await fetchInitialData();
  }, [fetchInitialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
        toast({ title: "Error", description: "El nombre de la receta es obligatorio.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);

    const recipeData = {
      name: formData.name,
      prep_time_min: formData.prep_time_min ? parseInt(formData.prep_time_min) : null,
      difficulty: formData.difficulty,
      instructions: formData.instructions
    };
    
    const ingredientsData = ingredients
      .filter(ing => ing.food_id)
      .map(ing => ({ 
        food_id: parseInt(ing.food_id), 
        grams: (ing.quantity !== '' && ing.quantity !== null) ? parseInt(ing.quantity, 10) : null 
      }));

    if (dietPlanRecipeId) {
      // 1. Update the Plan Recipe Record (Custom Metadata)
      const payload = {
        custom_name: recipeData.name,
        custom_prep_time_min: recipeData.prep_time_min,
        custom_difficulty: recipeData.difficulty,
        custom_instructions: recipeData.instructions,
        meal_name: mealName,
        is_customized: true // Mark as customized so UI prefers these fields over global recipe
      };

      const { error } = await supabase
        .from('diet_plan_recipes')
        .update(payload)
        .eq('id', dietPlanRecipeId);

      if (error) {
        toast({ title: "Error", description: `No se pudo actualizar la receta del plan: ${error.message}`, variant: "destructive" });
        setIsSubmitting(false);
        return;
      } 
      
      // 2. Update Ingredients (Delete Old -> Insert New)
      // This is crucial for the "variant" logic to work effectively in the data layer
      const { error: deleteError } = await supabase
        .from('diet_plan_recipe_ingredients')
        .delete()
        .eq('diet_plan_recipe_id', dietPlanRecipeId);

      if (deleteError) {
          console.error("Error deleting old ingredients:", deleteError);
      } else if (ingredientsData.length > 0) {
          const planIngredients = ingredientsData.map(ing => ({
              diet_plan_recipe_id: dietPlanRecipeId,
              food_id: ing.food_id,
              grams: ing.grams
          }));
          
          const { error: insertError } = await supabase
            .from('diet_plan_recipe_ingredients')
            .insert(planIngredients);
            
          if (insertError) {
              console.error("Error inserting new plan ingredients:", insertError);
              toast({ title: "Advertencia", description: "La receta se guardó, pero hubo un problema con los ingredientes.", variant: "warning" });
          }
      }

      // 3. Update Macros Cache
      await saveRecipeMacros(null, dietPlanRecipeId, currentMacros);
      
      toast({ title: "Éxito", description: "Receta del plan actualizada." });
      onSave();

    } else if (isAdminView) {
      // Global Recipe Logic (unchanged for template safety)
      let recipeId = selectedRecipe?.id;

      if (recipeId) {
        const { error } = await supabase.from('recipes').update(recipeData).eq('id', recipeId);
        if (error) { toast({ title: "Error", description: `Error al actualizar plantilla: ${error.message}`, variant: "destructive" }); setIsSubmitting(false); return; }
      } else {
        const { data, error } = await supabase.from('recipes').insert({ ...recipeData, created_by: user.id }).select('id').single();
        if (error) { toast({ title: "Error", description: `Error al crear plantilla: ${error.message}`, variant: "destructive" }); setIsSubmitting(false); return; }
        recipeId = data.id;
      }

      await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
      await supabase.from('recipe_sensitivities').delete().eq('recipe_id', recipeId);
      
      if (ingredientsData.length > 0) {
        const ingredientsToInsert = ingredientsData.map(ing => ({ ...ing, recipe_id: recipeId }));
        const { error: ingError } = await supabase.from('recipe_ingredients').insert(ingredientsToInsert);
        if (ingError) toast({ title: "Error Parcial", description: `Plantilla guardada, pero fallaron los ingredientes.`, variant: "destructive" });
      }
      
      if (selectedSensitivities.length > 0) {
        const sensitivitiesToInsert = selectedSensitivities.map(sensitivityId => ({ recipe_id: recipeId, sensitivity_id: sensitivityId }));
        const { error: sensitivitiesError } = await supabase.from('recipe_sensitivities').insert(sensitivitiesToInsert);
        if (sensitivitiesError) toast({ title: "Error Parcial", description: `Plantilla guardada, pero fallaron las sensibilidades.`, variant: "destructive" });
      }

      await saveRecipeMacros(recipeId, null, currentMacros);

      toast({ title: "Éxito", description: `Plantilla ${selectedRecipe ? 'actualizada' : 'creada'} correctamente.` });
      onSave();
    }

    setIsSubmitting(false);
  };

  if (isLoadingData) return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin text-[#5ebe7d]" /></div>;

  return (
    <div className="flex gap-8">
      {isAdminView && (
        <div className="w-[30%]">
          <RecipeListContainer
            onSelectRecipe={handlers.handleSelectRecipe}
            selectedRecipeId={selectedRecipe?.id}
            onDeleteRecipe={handlers.handleDeleteRecipe}
          />
        </div>
      )}
      
      <div className={isAdminView ? "w-[70%]" : "w-full"}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-[#5ebe7d]">Datos de la Receta</h4>
            <RecipeForm 
              formData={formData} 
              onFormChange={handlers.handleFormChange} 
              onSelectChange={handlers.handleSelectChange}
              isEditingFromPlan={!!dietPlanRecipeId}
              mealName={mealName}
              onMealNameChange={(e) => setMealName(e.target.value)}
            />
          </div>

          <CheckboxGrid 
            title="Evitar Sensibilidades" 
            options={allSensitivities} 
            selectedIds={selectedSensitivities} 
            onSelectionChange={setSelectedSensitivities} 
            color="green" 
          />

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-semibold text-[#5ebe7d]">Constructor de Ingredientes</h4>
              <div className="flex items-center rounded-md bg-slate-900 p-0.5">
                <Button type="button" onClick={() => setIngredientView('macros')} size="sm" className={`h-7 px-3 text-xs transition-colors ${ingredientView === 'macros' ? 'bg-slate-700 text-white shadow' : 'bg-transparent text-gray-400 hover:bg-slate-800'}`}>Macros</Button>
                <Button type="button" onClick={() => setIngredientView('micros')} size="sm" className={`h-7 px-3 text-xs transition-colors ${ingredientView === 'micros' ? 'bg-slate-700 text-white shadow' : 'bg-transparent text-gray-400 hover:bg-slate-800'}`}>Micros</Button>
              </div>
            </div>
            <div>
              <div className="grid px-2 pb-2 text-xs font-semibold text-gray-400 border-b border-slate-700 gap-x-4" style={ingredientView === 'macros' ? macroGridStyle : { gridTemplateColumns: 'minmax(150px, 1fr) 1fr 1fr 40px' }}><span>Alimento</span>{ingredientView === 'macros' ? (<><span className="text-center">Cantidad</span><span className="text-center">Medida</span><span className="text-center">Kcal</span><span className="text-center">Proteína</span><span className="text-center">Hidratos</span><span className="text-center">Grasas</span></>) : (<><span>Vitaminas</span><span>Minerales</span></>)}<span /></div>
              <div><AnimatePresence>{ingredients.map((ing) => <motion.div key={ing.local_id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}><IngredientRow ingredient={ing} view={ingredientView} allFoods={allFoods} availableFoods={availableFoods} calculateMacros={(ing) => calculateMacros(ing, allFoods)} onIngredientChange={handlers.handleIngredientChange} onRemove={handlers.removeIngredient} /></motion.div>)}</AnimatePresence></div>
              {ingredientView === 'macros' && (<div className="grid items-center gap-x-4 px-2 py-2 text-sm font-semibold text-white border-t border-slate-700 mt-2 rounded-md bg-green-900/20" style={macroGridStyle}><span className="font-bold col-span-3">TOTALES</span><span className="text-center font-mono font-bold text-orange-400">{totalMacros.k.toFixed(0)} kcal</span><span className="text-center font-mono font-bold text-green-400">{totalMacros.p.toFixed(1)}g</span><span className="text-center font-mono font-bold text-yellow-400">{totalMacros.c.toFixed(1)}g</span><span className="text-center font-mono font-bold text-pink-400">{totalMacros.f.toFixed(1)}g</span></div>)}
              <div className="flex gap-2 mt-3">
                <Button type="button" onClick={handlers.addIngredient} variant="outline" className="w-full border-dashed border-[#5ebe7d] text-[#5ebe7d] hover:bg-[#5ebe7d]/10"><PlusCircle className="w-4 h-4 mr-2" />Añadir Ingrediente</Button>
                <Dialog open={isCreateFoodOpen} onOpenChange={setIsCreateFoodOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" className="w-full border-[#5ebe7d] text-[#5ebe7d] hover:bg-[#5ebe7d]/10">
                      <Utensils className="mr-2 h-4 w-4"/>
                      {isAdminView ? 'Crear Alimento' : 'Solicitar nuevo Alimento'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#1a1e23] border-gray-700 text-white max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>{isAdminView ? 'Crear un nuevo alimento' : 'Solicitar un nuevo alimento'}</DialogTitle>
                      <DialogDescription>{isAdminView ? 'Este alimento estará disponible para todas las recetas.' : 'Tu solicitud será revisada por el administrador.'}</DialogDescription>
                    </DialogHeader>
                    <CreateFoodForm onFoodActionComplete={handleFoodCreated} isUserCreation={!isAdminView} userId={userId} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h5 className="font-semibold text-gray-300 mb-2 text-lg text-[#5ebe7d]">Recuento de Vitaminas</h5>
              <div className="flex flex-wrap gap-2">
                {allVitamins.filter(v => recipeNutrients.vitaminIds.includes(v.id)).map(v => (
                  <span key={v.id} className="bg-green-900/50 text-green-300 text-xs font-medium px-2.5 py-1 rounded-full">{v.name}</span>
                ))}
              </div>
            </div>
            <div>
              <h5 className="font-semibold text-gray-300 mb-2 text-lg text-[#5ebe7d]">Recuento de Minerales</h5>
              <div className="flex flex-wrap gap-2">
                {allMinerals.filter(m => recipeNutrients.mineralIds.includes(m.id)).map(m => (
                  <span key={m.id} className="bg-green-900/50 text-green-300 text-xs font-medium px-2.5 py-1 rounded-full">{m.name}</span>
                ))}
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full bg-[#5ebe7d] hover:bg-[#4a9960] transition-colors" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : (selectedRecipe ? 'Actualizar Receta' : 'Crear Receta')}</Button>
        </form>
      </div>
    </div>
  );
};

export default RecipeEditor;