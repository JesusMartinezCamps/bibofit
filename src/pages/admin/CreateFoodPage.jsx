import React, { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FoodSearch from '@/components/admin/recipes/FoodSearch';
import CreateFoodForm from '@/components/admin/recipes/CreateFoodForm';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useAuth } from '@/contexts/AuthContext';

const CreateFoodPage = () => {
  const [selectedFood, setSelectedFood] = useState(null);
  const [key, setKey] = useState(0); // Force re-render of form when clearing or updating
  const [refreshTrigger, setRefreshTrigger] = useState(0); // To trigger list reload
  const { user } = useAuth();
  const isCoach = user?.role === 'coach';

  const handleSelectFood = useCallback((food) => {
    setSelectedFood(food);
    // We want to ensure the form re-mounts with new data if we select a different food, 
    // though React often handles prop changes well, explicit keys help reset internal form state.
    setKey(prev => prev + 1);
  }, []);

  const handleCreateNew = () => {
    setSelectedFood(null);
    setKey(prev => prev + 1);
  };

  const handleFoodActionComplete = (newFood) => {
    // 1. Refresh the list
    setRefreshTrigger(prev => prev + 1);
    
    // 2. If we just saved a food (new or edit), update the selectedFood state so the form shows fresh data
    if (newFood) {
      setSelectedFood(newFood);
      // Force form re-mount to ensure useFoodForm initializes with new data
      setKey(prev => prev + 1);
    }
  };
  
  const breadcrumbItems = [
    { label: 'Gestión de Contenidos', href: isCoach ? '/coach/content' : '/admin-panel/content/nutrition' },
    { label: 'Nutrición', href: isCoach ? '/coach/content' : '/admin-panel/content/nutrition' },
    { label: selectedFood ? (isCoach ? selectedFood.name : 'Editar Alimento') : (isCoach ? 'Ver Alimentos' : 'Crear Alimento') },
  ];

  return (
    <>
      <Helmet>
        <title>{selectedFood ? `Editar: ${selectedFood.name}` : 'Crear Alimento'} - Gsus Martz</title>
      </Helmet>
      <main className="w-full px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="h-[calc(100vh-160px)]"
        >
          <Breadcrumbs items={breadcrumbItems} />
          
          <div className="flex flex-col lg:flex-row gap-6 h-full mt-4">
            {/* Sidebar Search - Left Side */}
            <div className="w-full lg:w-1/3 xl:w-1/4 bg-[#1a1e23] border border-gray-700 rounded-lg p-4 flex flex-col h-full overflow-hidden">
              <h2 className="text-xl font-bold text-white mb-4">Biblioteca de Alimentos</h2>
              <div className="flex-grow overflow-hidden">
                 <FoodSearch 
                    onSelectFood={handleSelectFood} 
                    selectedFoodId={selectedFood?.id}
                    refreshTrigger={refreshTrigger}
                    onActionComplete={() => setRefreshTrigger(prev => prev + 1)} // Refresh search on delete
                 />
              </div>
            </div>

            {/* Main Form Area - Right Side (Larger) */}
            <div className="w-full lg:w-2/3 xl:w-3/4 bg-[#1a1e23] border border-gray-700 rounded-lg p-6 overflow-y-auto h-full custom-scrollbar">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-green-400">
                  {selectedFood 
                    ? (isCoach ? selectedFood.name : `Editando: ${selectedFood.name}`) 
                    : (isCoach ? '' : 'Creando Nuevo Alimento')
                  }
                </h1>
                
                {/* Hide 'Crear nuevo alimento' button for coaches */}
                {!isCoach && selectedFood && (
                  <Button 
                    onClick={handleCreateNew} 
                    variant="outline-diet"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Crear nuevo alimento
                  </Button>
                )}
              </div>

               {/* Show placeholder if Coach and no food selected, else show form */}
               {isCoach && !selectedFood ? (
                 <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
                    <p className="text-lg">Selecciona un alimento de la lista para ver los detalles.</p>
                 </div>
               ) : (
                  <CreateFoodForm 
                    key={key + (selectedFood?.id || 'new')}
                    foodToEdit={selectedFood}
                    isEditing={!!selectedFood}
                    onFoodActionComplete={handleFoodActionComplete}
                  />
               )}
            </div>
          </div>
        </motion.div>
      </main>
    </>
  );
};

export default CreateFoodPage;