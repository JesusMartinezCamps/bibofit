import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Plus, ArrowLeft, RotateCcw, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import IngredientSearch from '@/components/plans/IngredientSearch';
import { useFreeRecipeDialog } from '@/components/plans/hooks/useFreeRecipeDialog';
import MacroDisplay from '@/components/plans/UI/MacroDisplay';
import IngredientRowConflict from '@/components/plans/UI/IngredientRowConflict';
import EquivalenceDialog from '@/components/plans/EquivalenceDialog';
import { calculateMacros } from '@/lib/macroCalculator';

const CreateFreeRecipePage = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const { date, mealId } = useParams();

    const [view, setView] = useState('main'); // 'main', 'search'
    const [loadingInitialData, setLoadingInitialData] = useState(true);
    const lastIngredientRef = useRef(null);

    const [isEquivalenceDialogOpen, setIsEquivalenceDialogOpen] = useState(false);
    const [recipeForEquivalence, setRecipeForEquivalence] = useState(null);
    const [recipeNameForToast, setRecipeNameForToast] = useState('');
    const [availableFoods, setAvailableFoods] = useState([]);
    const [userRestrictions, setUserRestrictions] = useState(null);
    const [dietPlanId, setDietPlanId] = useState(null);

    const targetUserId = user.id;

    const handleSaveSuccess = (newLog, newFreeMealWithOccurrence) => {
        setRecipeNameForToast(newFreeMealWithOccurrence.name);
        const recipeMacros = calculateMacros(newFreeMealWithOccurrence.free_recipe_ingredients, availableFoods);

        const recipeForDialog = {
            id: newFreeMealWithOccurrence.id,
            user_id: newFreeMealWithOccurrence.user_id,
            meal_date: newFreeMealWithOccurrence.meal_date,
            day_meal_id: newFreeMealWithOccurrence.day_meal_id,
            name: newFreeMealWithOccurrence.name,
            instructions: newFreeMealWithOccurrence.instructions,
            ingredients: newFreeMealWithOccurrence.free_recipe_ingredients,
            occurrence_id: newFreeMealWithOccurrence.occurrence_id, 
            free_recipe: { id: newFreeMealWithOccurrence.id } 
        };

        setRecipeForEquivalence({
            item: recipeForDialog,
            macros: recipeMacros,
            logId: newLog.id
        });
        setIsEquivalenceDialogOpen(true);
    };

    const {
        recipeName, setRecipeName,
        prepTime, setPrepTime,
        difficulty, setDifficulty,
        instructions, setInstructions,
        ingredients, setIngredients,
        macros,
        handleIngredientAdded,
        handleQuantityChange,
        handleRemoveIngredient,
        handleSave,
        isSaving,
        restoreDraft,
        hasSavedDraft
    } = useFreeRecipeDialog({
        targetUserId,
        dayMealId: mealId,
        dietPlanId,
        date,
        onSuccess: handleSaveSuccess,
        availableFoods,
    });
    
    const handleEquivalenceSuccess = (newAdjustment) => {
        setIsEquivalenceDialogOpen(false);
        setRecipeForEquivalence(null);
        toast({ title: 'Éxito', description: `Receta "${recipeNameForToast}" creada y equivalencia aplicada.` });
        navigate(`/plan/dieta/${date}`);
    };
    
    const handleEquivalenceDialogClose = (isOpen) => {
        if (!isOpen && recipeForEquivalence) {
            setIsEquivalenceDialogOpen(false);
            setRecipeForEquivalence(null);
            toast({ title: 'Éxito', description: `Receta "${recipeNameForToast}" creada y añadida al plan.` });
            navigate(`/plan/dieta/${date}`);
        } else {
             setIsEquivalenceDialogOpen(isOpen);
        }
    };

    const fetchInitialData = useCallback(async () => {
        setLoadingInitialData(true);
        try {
            const [foodsRes, userFoodsRes, restrictionsRes, preferredFoodsRes, nonPreferredFoodsRes] = await Promise.all([
                supabase.from('food').select(`*, food_sensitivities(sensitivities(id, name)), food_medical_conditions(medical_conditions(id, name), relation_type)`),
                supabase.from('user_created_foods').select(`*, food_sensitivities:user_created_food_sensitivities(sensitivities(id, name))`).eq('user_id', targetUserId),
                supabase.rpc('get_user_restrictions', { p_user_id: targetUserId }),
                supabase.from('preferred_foods').select('food(*)').eq('user_id', targetUserId),
                supabase.from('non_preferred_foods').select('food(*)').eq('user_id', targetUserId)
            ]);
            
            // Fetch Active Diet Plan ID
            const { data: planData, error: planError } = await supabase
                .from('diet_plans')
                .select('id')
                .eq('user_id', targetUserId)
                .lte('start_date', date)
                .gte('end_date', date)
                .eq('is_active', true)
                .maybeSingle();

            if (planError) {
                console.error("Error fetching diet plan:", planError);
            }
            if (planData) {
                setDietPlanId(planData.id);
            }

            if (foodsRes.error || userFoodsRes.error || restrictionsRes.error || preferredFoodsRes.error || nonPreferredFoodsRes.error) {
                throw new Error(foodsRes.error?.message || userFoodsRes.error?.message || restrictionsRes.error?.message || preferredFoodsRes.error?.message || nonPreferredFoodsRes.error?.message || "An unknown error occurred while fetching initial data.");
            }

            const publicFoods = (foodsRes.data || []).map(f => ({ ...f, is_user_created: false }));
            const userFoods = (userFoodsRes.data || []).map(f => ({ ...f, is_user_created: true }));
            setAvailableFoods([...publicFoods, ...userFoods]);
            
            const finalRestrictions = {
                ...(restrictionsRes.data || {}),
                preferred_foods: (preferredFoodsRes.data || []).map(item => item.food),
                non_preferred_foods: (nonPreferredFoodsRes.data || []).map(item => item.food),
            };
            setUserRestrictions(finalRestrictions);

        } catch (error) {
            console.error('Error fetching initial data for FreeRecipePage:', error);
            toast({ title: 'Error', description: 'No se pudieron cargar los datos necesarios para crear la receta.', variant: 'destructive' });
        } finally {
            setLoadingInitialData(false);
        }
    }, [targetUserId, toast, date]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    useEffect(() => {
        if (!date || !mealId) {
            toast({ title: 'Error', description: 'Falta información. Vuelve al plan e inténtalo de nuevo.', variant: 'destructive' });
            navigate('/plan/dieta');
        }
    }, [date, mealId, navigate, toast]);

    useEffect(() => {
        if (lastIngredientRef.current) {
            lastIngredientRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [ingredients.length]);

    const handleLocalIngredientAdded = (newIngredient) => {
        handleIngredientAdded(newIngredient);
        setView('main');
    };

    const renderContent = () => {
        if (loadingInitialData) {
            return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-green-500" /></div>;
        }

        switch (view) {
            case 'search':
                return (
                    <IngredientSearch
                        selectedIngredients={ingredients}
                        onIngredientAdded={handleLocalIngredientAdded}
                        availableFoods={availableFoods}
                        userRestrictions={userRestrictions}
                        onBack={() => setView('main')}
                    />
                );
            case 'main':
            default:
                return (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-semibold">Detalles de la Receta</h3>
                            {hasSavedDraft && (
                                <div className="flex items-center gap-2">
                                     <span className="text-xs text-green-400 flex items-center gap-1">
                                        <CheckCircle2 size={12} /> Borrador guardado
                                     </span>
                                </div>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="recipeName" className="block text-sm font-medium text-gray-300">Nombre de la Receta</label>
                            <Input id="recipeName" type="text" placeholder="Ej: Pollo al curry con arroz" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} className="input-field" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="prepTime" className="block text-sm font-medium text-gray-300">Tiempo (min)</label>
                                <Input id="prepTime" type="number" placeholder="Ej: 30" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} className="input-field" />
                            </div>
                            <div>
                                <label htmlFor="difficulty" className="block text-sm font-medium text-gray-300">Dificultad</label>
                                <Select value={difficulty} onValueChange={setDifficulty}>
                                    <SelectTrigger className="input-field"><SelectValue placeholder="Selecciona dificultad" /></SelectTrigger>
                                    <SelectContent><SelectItem value="Fácil">Fácil</SelectItem><SelectItem value="Media">Media</SelectItem><SelectItem value="Difícil">Difícil</SelectItem></SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="instructions" className="block text-sm font-medium text-gray-300">Instrucciones</label>
                            <Textarea id="instructions" placeholder="Describe los pasos..." value={instructions} onChange={(e) => setInstructions(e.target.value)} className="input-field min-h-[120px]" />
                        </div>
                        <div className="border-t border-gray-700 my-4"></div>
                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold">Ingredientes</h3>
                            <MacroDisplay macros={macros} title="Macros Totales de la Receta" />
                            <AnimatePresence>
                                {ingredients.length > 0 && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                                        {ingredients.map((ing, index) => (
                                            <motion.div key={ing.food_id ? `${ing.food_id}-${ing.is_user_created}` : `free-${index}`} ref={index === ingredients.length - 1 ? lastIngredientRef : null} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                                                <IngredientRowConflict ingredient={ing} index={index} onQuantityChange={handleQuantityChange} onRemove={handleRemoveIngredient} availableFoods={availableFoods} userRestrictions={userRestrictions} />
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <Button onClick={() => setView('search')} variant="outline" className="w-full border-dashed border-emerald-500 text-emerald-300 bg-emerald-900/20 hover:bg-emerald-500/20 hover:text-emerald-200">
                                <Plus className="mr-2 h-4 w-4 text-emerald-500" /> Añadir Ingrediente
                            </Button>
                        </div>
                    </div>
                );
        }
    };
    
    const getTitle = () => {
        switch (view) {
          case 'search': return 'Añadir Ingrediente';
          default: return 'Crear Receta Libre';
        }
    };

    const BackButton = () => (
        <Button variant="ghost" asChild>
            <Link to={view === 'main' ? `/plan/dieta/${date}` : '#'} onClick={view !== 'main' ? () => setView('main') : undefined} className="flex items-center gap-2 text-gray-300 hover:text-white hover:bg-gray-700">
                <ArrowLeft size={18} />
                {view === 'main' ? 'Volver al Plan' : 'Volver a la receta'}
            </Link>
        </Button>
    );

    return (
        <>
            <Helmet>
                <title>Crear Receta Libre - Gsus Martz</title>
                <meta name="description" content="Crea y añade una receta libre a tu plan de dieta." />
            </Helmet>
            <div className="container mx-auto max-w-4xl pt-0 pb-8 px-4 sm:pt-8">
                <div className="mb-0 sm:mb-6">
                    <BackButton />
                </div>
                <Card className="bg-gray-900/50 border-gray-700 text-white">
                    <CardHeader>
                        <CardTitle className="text-3xl font-bold text-green-400">{getTitle()}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {renderContent()}
                    </CardContent>
                    {view === 'main' && (
                        <CardFooter>
                            <Button onClick={handleSave} disabled={isSaving || !recipeName || ingredients.length === 0} className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg">
                                {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                Guardar Receta
                            </Button>
                        </CardFooter>
                    )}
                </Card>
            </div>
            {recipeForEquivalence && (
                <EquivalenceDialog
                    open={isEquivalenceDialogOpen}
                    onOpenChange={handleEquivalenceDialogClose}
                    sourceItem={recipeForEquivalence.item}
                    sourceItemType="free_recipe"
                    sourceItemMacros={recipeForEquivalence.macros}
                    sourceLogId={recipeForEquivalence.logId}
                    onSuccess={handleEquivalenceSuccess}
                />
            )}
        </>
    );
};

export default CreateFreeRecipePage;