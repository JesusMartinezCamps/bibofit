import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Plus, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import IngredientSearch from '@/components/plans/IngredientSearch';
import { useSnackLogging } from '@/components/plans/hooks/useSnackLogging';
import { calculateMacros } from '@/lib/macroCalculator';
import MacroDisplay from '@/components/plans/UI/MacroDisplay';
import IngredientRowConflict from '@/components/plans/UI/IngredientRowConflict';
import EquivalenceDialog from '@/components/plans/EquivalenceDialog';

const CreateSnackPage = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const { date, mealId } = useParams();

    const [view, setView] = useState('main'); // 'main', 'search'
    const [loadingInitialData, setLoadingInitialData] = useState(true);
    const [activePlan, setActivePlan] = useState(null);
    const lastIngredientRef = useRef(null);

    const [isEquivalenceDialogOpen, setIsEquivalenceDialogOpen] = useState(false);
    const [snackForEquivalence, setSnackForEquivalence] = useState(null);
    const [snackNameForToast, setSnackNameForToast] = useState('');

    const targetUserId = user.id;

    const handleSaveSuccess = (newLog, newSnackWithOccurrence) => {
        setSnackNameForToast(newSnackWithOccurrence.name);
        const snackMacros = calculateMacros(newSnackWithOccurrence.snack_ingredients, availableFoods);
        setSnackForEquivalence({
            item: newSnackWithOccurrence,
            macros: snackMacros,
            logId: newLog.id,
        });
        setIsEquivalenceDialogOpen(true);
    };

    const {
        isSubmitting,
        name, setName,
        ingredients, setIngredients,
        availableFoods, setAvailableFoods,
        userRestrictions, setUserRestrictions,
        handleSubmit,
    } = useSnackLogging({ 
        userId: targetUserId, 
        onSaveSuccess: handleSaveSuccess, 
        mealDate: date, 
        preselectedMealId: mealId 
    });

    // Create a local map for internal efficient lookups within this page components
    const foodsIndex = useMemo(() => {
        const m = new Map();
        for (const f of availableFoods || []) {
            const key = `${String(f.id)}|${f.is_user_created ? 1 : 0}`;
            m.set(key, f);
        }
        return m;
    }, [availableFoods]);

    const handleEquivalenceSuccess = (newAdjustment) => {
        setIsEquivalenceDialogOpen(false);
        setSnackForEquivalence(null);
        toast({ title: 'Éxito', description: `Picoteo "${snackNameForToast}" creado y equivalencia aplicada.`, variant: 'success' });
        navigate(`/plan/dieta/${date}`);
    };
    
    const handleEquivalenceDialogClose = (isOpen) => {
        if (!isOpen && snackForEquivalence) {
            setIsEquivalenceDialogOpen(false);
            setSnackForEquivalence(null);
            toast({ title: 'Éxito', description: `Picoteo "${snackNameForToast}" creado y añadido al plan.`, variant: 'success' });
            navigate(`/plan/dieta/${date}`);
        } else {
             setIsEquivalenceDialogOpen(isOpen);
        }
    };


    const fetchInitialData = useCallback(async () => {
        setLoadingInitialData(true);
        try {
            const [foodsRes, userCreatedFoodsRes, restrictionsRes, activePlanRes, preferredFoodsRes, nonPreferredFoodsRes] = await Promise.all([
                supabase.from('food').select(`*, food_to_food_groups(food_group_id, food_groups(id, name)), food_sensitivities(sensitivities(id, name)), food_medical_conditions(medical_conditions(id, name), relation_type)`).is('user_id', null),
                supabase.from('food').select(`*, food_to_food_groups(food_group_id, food_groups(id, name)), food_sensitivities(sensitivities(id, name)), food_medical_conditions(medical_conditions(id, name), relation_type)`).eq('user_id', targetUserId).neq('status', 'rejected'),
                supabase.rpc('get_user_restrictions', { p_user_id: targetUserId }),
                supabase.from('diet_plans').select('id').eq('user_id', targetUserId).eq('is_active', true).maybeSingle(), // Use maybeSingle for safety
                supabase.from('preferred_foods').select('food(*)').eq('user_id', targetUserId),
                supabase.from('non_preferred_foods').select('food(*)').eq('user_id', targetUserId),
            ]);

            if (foodsRes.error) throw foodsRes.error;
            if (userCreatedFoodsRes.error) throw userCreatedFoodsRes.error;
            if (restrictionsRes.error) throw restrictionsRes.error;
            if (activePlanRes.error && activePlanRes.error.code !== 'PGRST116') throw activePlanRes.error;
            if (preferredFoodsRes.error) throw preferredFoodsRes.error;
            if (nonPreferredFoodsRes.error) throw nonPreferredFoodsRes.error;
            
            const publicFoods = (foodsRes.data || []).map(f => ({ ...f, is_user_created: false }));
            const userFoods = (userCreatedFoodsRes.data || []).map(f => ({ ...f, is_user_created: true }));
            const combinedFoods = [...publicFoods, ...userFoods];

            setAvailableFoods(combinedFoods);

            const finalRestrictions = {
                ...restrictionsRes.data,
                preferred_foods: (preferredFoodsRes.data || []).map(item => item.food),
                non_preferred_foods: (nonPreferredFoodsRes.data || []).map(item => item.food),
            };
            setUserRestrictions(finalRestrictions);
            
            setActivePlan(activePlanRes.data);

        } catch (error) {
            console.error('Error fetching initial data:', error);
            toast({ title: 'Error', description: 'No se pudieron cargar los datos necesarios.', variant: 'destructive' });
        } finally {
            setLoadingInitialData(false);
        }
    }, [targetUserId, toast, setAvailableFoods, setUserRestrictions]);

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

    const handleIngredientAdded = (newIngredient) => {
        setIngredients(prev => [...prev, newIngredient]);
        setView('main');
    };

    const removeIngredient = (index) => {
        setIngredients(prev => prev.filter((_, i) => i !== index));
    };

    const updateIngredientGrams = (index, grams) => {
        const g = Number(grams) || 0;

        setIngredients(prev =>
            prev.map((ing, i) =>
                i === index
                    ? { ...ing, grams: g, quantity: g } // grams manda en calculateMacros
                    : ing
            )
        );
    };

    const totalMacros = useMemo(() => {
      // Pass original availableFoods array for compatibility
      return calculateMacros(ingredients, availableFoods);
    }, [ingredients, availableFoods]);


    const renderContent = () => {
        if (loadingInitialData) {
            return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-orange-500" /></div>;
        }

        switch (view) {
            case 'search':
                return (
                    <IngredientSearch
                        selectedIngredients={ingredients}
                        onIngredientAdded={handleIngredientAdded}
                        availableFoods={availableFoods}
                        userRestrictions={userRestrictions}
                        createFoodUserId={targetUserId}
                        onBack={() => setView('main')}
                    />
                );
            case 'main':
            default:
                return (
                    <div className="space-y-6">
                        <div>
                            <Label htmlFor="name" className="text-base">Nombre del Picoteo</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="input-field mt-1 text-lg" placeholder="Ej: Un puñado de almendras" />
                        </div>
                        <div className="border-t border-border my-4"></div>
                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold">Ingredientes</h3>
                            <MacroDisplay macros={totalMacros} title="Macros Totales del Picoteo" />
                            <AnimatePresence>
                                {ingredients.length > 0 && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                                        {ingredients.map((ingredient, index) => (
                                            <motion.div key={ingredient.food_id ? `${ingredient.food_id}-${ingredient.is_user_created}` : `free-${index}`} ref={index === ingredients.length - 1 ? lastIngredientRef : null} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                                                <IngredientRowConflict ingredient={ingredient} index={index} onQuantityChange={updateIngredientGrams} onRemove={removeIngredient} availableFoods={availableFoods} userRestrictions={userRestrictions} />
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <Button onClick={() => setView('search')} variant="outline" className="w-full border-dashed border-orange-500/60 text-orange-700 dark:text-orange-200 bg-orange-500/10 dark:bg-orange-900/20 hover:bg-orange-500/20">
                                <Plus className="mr-2 h-4 w-4 text-orange-500" /> Añadir Ingrediente
                            </Button>
                        </div>
                    </div>
                );
        }
    };
    
    const handleBack = () => {
        if (view === 'search') {
            setView('main');
        } else {
            navigate(`/plan/dieta/${date}`);
        }
    };

    const getTitle = () => {
        switch (view) {
          case 'search': return 'Añadir Ingrediente';
          default: return 'Añadir Picoteo';
        }
    };

    return (
        <>
            <Helmet>
                <title>Añadir Picoteo - Gsus Martz</title>
                <meta name="description" content="Crea y añade un picoteo a tu plan de dieta." />
            </Helmet>
            <div className="container mx-auto max-w-4xl pt-0 pb-0 px-0 sm:pt-8 sm:pb-8 sm:px-4">
                <div className="sm:rounded-2xl sm:border sm:border-border sm:bg-card/55 sm:p-6 sm:shadow-sm">
                    <Card className="bg-card/90 border-0 sm:border sm:border-border text-foreground shadow-none sm:shadow-sm rounded-none sm:rounded-xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-3xl font-bold text-orange-400">
                                <Button variant="ghost" size="icon" onClick={handleBack} className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0">
                                    <ArrowLeft size={22} />
                                </Button>
                                {getTitle()}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {renderContent()}
                        </CardContent>
                        {view === 'main' && (
                            <CardFooter>
                                <Button 
                                    onClick={() => handleSubmit({ dietPlanId: activePlan?.id })}
                                    disabled={isSubmitting || !name || ingredients.length === 0} 
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-orange-950 dark:text-white py-6 text-lg"
                                >
                                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                    Guardar Picoteo
                                </Button>
                            </CardFooter>
                        )}
                    </Card>
                </div>
            </div>
            {snackForEquivalence && (
                <EquivalenceDialog
                    open={isEquivalenceDialogOpen}
                    onOpenChange={handleEquivalenceDialogClose}
                    sourceItem={snackForEquivalence.item}
                    sourceItemType="snack"
                    sourceItemMacros={snackForEquivalence.macros}
                    sourceLogId={snackForEquivalence.logId}
                    onSuccess={handleEquivalenceSuccess}
                />
            )}
        </>
    );
};

export default CreateSnackPage;
