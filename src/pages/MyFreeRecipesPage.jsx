import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Loader2, Utensils } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import TabNavigation from '@/components/admin/UserCreatedFoods/TabNavigation';
import FreeRecipeViewDialog from '@/components/plans/FreeRecipeViewDialog';

const MyFreeRecipesPage = () => {
  const { user } = useAuth();
  const [allRecipes, setLoading] = useState([]);
  const [loading, setLoadingStatus] = useState(true);
  const [activeTab, setActiveTab] = useState('approved');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchRecipes = async () => {
    if (!user) return;
    setLoadingStatus(true);
    try {
      const { data, error } = await supabase
        .from('free_recipes')
        .select(`
          *,
          day_meal:day_meal_id(name),
          ingredients:free_recipe_ingredients(
            *, 
            food:food_id(
              *, 
              food_to_food_groups(food_group_id)
            ), 
            user_created_food:user_created_food_id(*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLoading(data || []);
    } catch (error) {
      console.error("Error fetching free recipes:", error);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, [user]);

  const handleRecipeUpdate = (updatedRecipe) => {
    setLoading(prevRecipes => {
        const exists = prevRecipes.find(r => r.id === updatedRecipe.id);
        if (exists) {
            return prevRecipes.map(r => r.id === updatedRecipe.id ? updatedRecipe : r);
        } else {
            return [updatedRecipe, ...prevRecipes];
        }
    });
    setSelectedRecipe(updatedRecipe);
  };

  const filteredRecipes = useMemo(() => {
    if (activeTab === 'approved') {
      return allRecipes.filter(recipe => recipe.status === 'approved_private' || recipe.status === 'approved_general');
    }
    return allRecipes.filter(recipe => recipe.status === activeTab);
  }, [allRecipes, activeTab]);

  const pendingCount = useMemo(() => {
    return allRecipes.filter(recipe => recipe.status === 'pending').length;
  }, [allRecipes]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">Pendiente</Badge>;
      case 'approved_private':
        return <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">Guardada como Privada</Badge>;
      case 'approved_general':
         return <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">Guardada como General</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="bg-red-500/20 text-red-300 border-red-500/30">Rechazada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCardClick = (recipe) => {
    setSelectedRecipe(recipe);
    setIsModalOpen(true);
  };

  const formatIngredients = (ingredients) => {
    if (!ingredients || ingredients.length === 0) return "Sin ingredientes";
    return ingredients.map(ing => {
      const food = ing.food || ing.user_created_food;
      const name = food?.name || 'Alimento desconocido';
      const qty = Math.round(ing.grams || 0);
      const isUnits = food?.food_unit === 'unidades';
      const unit = isUnits ? (qty === 1 ? 'Ud' : 'Uds') : 'g';
      return `${name} (${qty} ${unit})`;
    }).join(', ');
  };

  const tabs = [
    { value: 'approved', label: 'Aprobadas' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'rejected', label: 'Rechazadas' },
  ];

  return (
    <>
      <Helmet>
        <title>Mis Recetas Libres - Gsus Martz</title>
        <meta name="description" content="Consulta el historial de tus recetas libres y su estado." />
      </Helmet>
      <main className="w-full px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-white flex items-center justify-center gap-4">
              <Utensils className="w-10 h-10 text-blue-400" />
              Mis Recetas Libres
            </h1>
            <p className="text-gray-400 mt-2">Aquí puedes ver el historial de las recetas que has creado.</p>
          </div>

          <TabNavigation 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
            pendingCount={pendingCount}
            tabs={tabs}
          />

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-12 h-12 animate-spin text-blue-400" />
            </div>
          ) : filteredRecipes.length === 0 ? (
            <Card className="bg-gray-800/50 border-gray-700 text-center py-12">
              <CardContent>
                <p className="text-gray-400">No tienes recetas en esta categoría.</p>
                 {activeTab === 'pending' && <p className="text-gray-500 text-sm mt-2">¡Anímate a crear una desde tu plan de dieta!</p>}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredRecipes.map((recipe, index) => (
                <motion.div
                  key={recipe.id}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 * index }}
                >
                  <Card 
                    onClick={() => handleCardClick(recipe)}
                    className="bg-gray-800/50 border-gray-700 hover:border-blue-500/50 transition-colors cursor-pointer"
                  >
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-white">{recipe.name}</CardTitle>
                        <CardDescription className="text-gray-400">
                          {recipe.day_meal?.name} - {format(new Date(recipe.created_at), 'dd MMMM, yyyy', { locale: es })}
                        </CardDescription>
                      </div>
                      {getStatusBadge(recipe.status)}
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-300 text-sm">
                        {formatIngredients(recipe.ingredients)}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
      {selectedRecipe && (
        <FreeRecipeViewDialog
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          freeMeal={selectedRecipe}
          onUpdate={handleRecipeUpdate}
        />
      )}
    </>
  );
};

export default MyFreeRecipesPage;