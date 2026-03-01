import React, { useState } from 'react';
import { Loader2, Utensils, Inbox, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import FoodCard from './FoodCard';
import FoodDetailModal from './FoodDetailModal';

const FoodsList = ({ 
  userFoods,
  foods,
  loadingFoods,
  loading,
  selectedUser, 
  activeTab, 
  onImport, 
  onReject, 
  onDelete, 
  allSensitivities,
  onActionComplete,
  onFoodAction
}) => {
  const foodsToRender = userFoods || foods || [];
  const isLoading = loadingFoods ?? loading ?? false;

  const [selectedFood, setSelectedFood] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionContext, setActionContext] = useState('card');

  const getTitle = () => {
    switch (activeTab) {
      case 'pending': return 'Alimentos Pendientes';
      case 'rejected': return 'Alimentos Rechazados';
      case 'approved': return 'Alimentos Aprobados';
      default: return 'Alimentos';
    }
  };

  const getDescription = () => {
    if (!selectedUser) {
      return 'Selecciona un usuario para ver sus alimentos';
    }
    
    switch (activeTab) {
      case 'pending': return `Mostrando alimentos pendientes de ${selectedUser.full_name}`;
      case 'rejected': return `Mostrando alimentos rechazados de ${selectedUser.full_name}`;
      case 'approved': return `Mostrando alimentos aprobados de ${selectedUser.full_name}`;
      default: return '';
    }
  };

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'pending': return 'No hay alimentos pendientes para este usuario.';
      case 'rejected': return 'No hay alimentos rechazados para este usuario.';
      case 'approved': return 'No hay alimentos aprobados para este usuario.';
      default: return 'No hay alimentos para este usuario.';
    }
  };

  const handleCardClick = (food) => {
    setSelectedFood(food);
    setActionContext('card');
    setModalOpen(true);
  };

  const handleImport = (food, type) => {
    if (!onImport) return;
    onImport(food, type, (context) => {
      setSelectedFood(food);
      setActionContext(context);
      setModalOpen(true);
    });
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedFood(null);
    setActionContext('card');
  };

  return (
    <>
      <Card className="md:col-span-2 bg-[#1a1e23] border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Utensils className="mr-2" /> {getTitle()}
          </CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin h-8 w-8 text-[#5ebe7d]" />
            </div>
          ) : !selectedUser ? (
            <div className="text-center py-12 text-gray-400">
              <Inbox className="mx-auto h-12 w-12" />
              <p>Selecciona un usuario de la lista</p>
            </div>
          ) : foodsToRender.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <p>{getEmptyMessage()}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {foodsToRender.map(food => (
                <FoodCard 
                  key={food.id} 
                  food={food} 
                  onImport={handleImport}
                  onReject={onReject}
                  onDelete={onDelete}
                  onCardClick={handleCardClick}
                  allSensitivities={allSensitivities}
                  showActions={Boolean(onImport || onReject || onDelete) && activeTab !== 'approved'}
                  showDate={activeTab !== 'pending'}
                  showApprovalType={activeTab === 'approved'}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FoodDetailModal
        food={selectedFood}
        isOpen={modalOpen}
        onClose={handleModalClose}
        onActionComplete={onActionComplete}
        allSensitivities={allSensitivities}
        actionContext={actionContext}
      />
    </>
  );
};

export default FoodsList;
