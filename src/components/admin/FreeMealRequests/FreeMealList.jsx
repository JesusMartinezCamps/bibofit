import React, { useState } from 'react';
import { Loader2, UtensilsCrossed, Inbox, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import FreeMealCard from './FreeMealCard';
import FreeMealApprovalModal from './FreeMealApprovalModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';

const FreeMealList = ({ 
  freeRecipes, 
  loadingRecipes, 
  selectedUser, 
  activeTab, 
  onActionComplete // 2) Ensure FreeMealList.jsx receives onActionComplete as a prop correctly
}) => {
  const [selectedFreeRecipe, setSelectedFreeRecipe] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleReview = (recipe) => {
    setSelectedFreeRecipe(recipe);
    setModalOpen(true);
  };

  const openDeleteConfirmation = (recipeId) => {
    setRecipeToDelete(recipeId);
    setConfirmDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!recipeToDelete) return;

    try {
      const { error } = await supabase.rpc('delete_free_recipe_and_occurrences', { p_free_recipe_id: recipeToDelete });
      if (error) throw error;

      toast({ title: 'Éxito', description: 'Receta libre eliminada permanentemente.' });
      if (onActionComplete) onActionComplete();
    } catch (error) {
      toast({ title: 'Error', description: `No se pudieron eliminar la receta: ${error.message}`, variant: 'destructive' });
    } finally {
      setConfirmDeleteOpen(false);
      setRecipeToDelete(null);
    }
  };

  const handleAction = async (actionType, recipe, data) => {
    try {
        if (actionType === 'approve_private') {
            const recipeData = {
                name: data.name,
                instructions: data.instructions,
                prep_time_min: data.prep_time_min,
                difficulty: data.difficulty,
            };
            const ingredientsData = data.ingredients.map(ing => ({
                food_id: ing.food_id,
                grams: ing.grams,
            }));

            const { error } = await supabase.rpc('convert_free_to_private_recipe', {
                p_free_recipe_id: recipe.id,
                p_new_recipe_data: recipeData,
                p_new_ingredients: ingredientsData,
            });

            if (error) throw error;
            toast({ title: 'Éxito', description: 'Receta privada creada y asignada al plan del cliente. La receta libre original ha sido eliminada.' });
            // 5) Call onActionComplete after "Guardar como Receta Privada" button is clicked

        } else if (actionType === 'approve_general') {
            const ingredientsForRpc = data.ingredients.map(ing => ({
                food_id: ing.food_id,
                grams: ing.grams,
                food_group_id: ing.food_group_id
            }));
            
            const recipeData = {
                name: data.name,
                instructions: data.instructions,
                prep_time_min: data.prep_time_min,
                difficulty: data.difficulty
            };

            const { data: rpcData, error } = await supabase.rpc('approve_free_recipe_as_global', {
                p_free_recipe_id: recipe.id,
                p_recipe_data: recipeData,
                p_ingredients: ingredientsForRpc,
            });
            
            if (error) throw error;
            if (rpcData && !rpcData.success) throw new Error(rpcData.error || 'Error al aprobar como global');

            toast({ title: 'Éxito', description: 'La receta libre ha sido guardada como plantilla y asignada al plan. La receta libre original ha sido eliminada.' });
            // 3) Call onActionComplete after "Guardar Como Plantilla" button is clicked

        } else if (actionType === 'keep_as_free_recipe') {
            await supabase.from('free_recipes').update({ status: 'kept_as_free_recipe' }).eq('id', recipe.id);
            toast({ title: 'Guardado', description: 'La solicitud se archivó y se mantiene como receta libre para el cliente.' });
            // 4) Call onActionComplete after "Dejar como Receta Libre" button is clicked

        } else if (actionType === 'reject') {
            await supabase.from('free_recipes').update({ status: 'rejected' }).eq('id', recipe.id);
            toast({ title: 'Rechazado', description: 'La receta libre ha sido rechazada y no estará disponible para el cliente.' });
        }
        
        // Execute refresh callback after any successful action
        if (onActionComplete) {
            await onActionComplete(); 
        }
        setModalOpen(false);
    } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: `Ocurrió un error: ${error.message}`, variant: 'destructive' });
    }
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'pending': return 'Recetas Libres Pendientes';
      case 'approved_private': return 'Aprobadas (Privada)';
      case 'approved_general': return 'Aprobadas (Plantilla)';
      case 'kept_as_free_recipe': return 'Recetas Libres Guardadas';
      case 'rejected': return 'Recetas Libres Rechazadas';
      default: return 'Recetas Libres';
    }
  };

  const getDescription = () => {
    if (!selectedUser) return 'Selecciona un usuario para ver sus recetas libres';

    const clientName = (
        <span 
            className="font-bold text-cyan-400 cursor-pointer hover:underline"
            onClick={() => navigate(`/admin/manage-diet/${selectedUser.user_id}`)}
        >
            {selectedUser.full_name}
        </span>
    );
    
    switch (activeTab) {
      case 'pending': return <>Mostrando recetas pendientes de {clientName}</>;
      case 'approved_private': return <>Mostrando recetas aprobadas (privadas) de {clientName}</>;
      case 'approved_general': return <>Mostrando recetas aprobadas (plantillas) de {clientName}</>;
      case 'kept_as_free_recipe': return <>Mostrando recetas guardadas como libres de {clientName}</>;
      case 'rejected': return <>Mostrando recetas rechazadas de {clientName}</>;
      default: return '';
    }
  };

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'pending': return 'Este usuario no tiene recetas pendientes.';
      case 'approved_private': return 'Este usuario no tiene recetas aprobadas como privadas.';
      case 'approved_general': return 'Este usuario no tiene recetas aprobadas como plantillas.';
      case 'kept_as_free_recipe': return 'Este usuario no tiene recetas guardadas como libres.';
      case 'rejected': return 'Este usuario no tiene recetas rechazadas.';
      default: return 'No hay recetas para este usuario.';
    }
  };

  return (
    <>
      <Card className="md:col-span-2 bg-[#1a1e23] border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="flex items-center">
            <UtensilsCrossed className="mr-2" /> {getTitle()}
          </CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRecipes ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin h-8 w-8 text-[#5ebe7d]" />
            </div>
          ) : !selectedUser ? (
            <div className="text-center py-12 text-gray-400">
              <Inbox className="mx-auto h-12 w-12" />
              <p>Selecciona un usuario de la lista</p>
            </div>
          ) : freeRecipes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <p>{getEmptyMessage()}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {freeRecipes.map(recipe => (
                <FreeMealCard 
                  key={recipe.id} 
                  freeMeal={recipe} 
                  onReview={handleReview}
                  onDelete={activeTab === 'rejected' ? openDeleteConfirmation : null}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FreeMealApprovalModal
        freeMeal={selectedFreeRecipe}
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
        onAction={handleAction}
      />

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la receta libre de forma permanente. No se podrá recuperar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FreeMealList;