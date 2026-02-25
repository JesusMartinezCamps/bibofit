import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import CaloriesIcon from '@/components/icons/CaloriesIcon';

const FoodInfoView = ({ food, allSensitivities }) => {
  const sensitivityNames = useMemo(() => {
    if (!food?.selected_allergies || !allSensitivities || food.selected_allergies.length === 0) {
      return null;
    }
    return food.selected_allergies
      .map(id => allSensitivities.find(allergy => allergy.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }, [food?.selected_allergies, allSensitivities]);

  const vitaminNames = useMemo(() => {
    if (!food?.selected_vitamins || food.selected_vitamins.length === 0) {
      return 'No especificadas';
    }
    return food.selected_vitamins.join(', ');
  }, [food?.selected_vitamins]);

  const mineralNames = useMemo(() => {
    if (!food?.selected_minerals || food.selected_minerals.length === 0) {
      return 'No especificados';
    }
    return food.selected_minerals.join(', ');
  }, [food?.selected_minerals]);

  const foodGroupNames = useMemo(() => {
    if (!food?.food_groups || food.food_groups.length === 0) {
      return 'Sin grupo';
    }
    return food.food_groups.map(group => group.name).join(', ');
  }, [food?.food_groups]);


  if (!food) {
    return null;
  }
  
  const calories = (food.proteins || 0) * 4 + (food.total_carbs || 0) * 4 + (food.total_fats || 0) * 9;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getApprovalTypeInfo = () => {
    if (food.status === 'approved_general') {
      return { text: 'Aprobado General', color: 'text-green-400', bgColor: 'bg-green-900/30' };
    } else if (food.status === 'approved_private') {
      return { text: 'Aprobado Privado', color: 'text-purple-400', bgColor: 'bg-purple-900/30' };
    } else if (food.status === 'pending') {
        return { text: 'Pendiente', color: 'text-yellow-400', bgColor: 'bg-yellow-900/30' };
    } else if (food.status === 'rejected') {
        return { text: 'Rechazado', color: 'text-red-400', bgColor: 'bg-red-900/30' };
    }
    return null;
  };

  const approvalInfo = getApprovalTypeInfo();

  const getSeasonName = () => {
    if (food.selected_season_id) {
      const seasons = { 1: 'Primavera', 2: 'Verano', 3: 'Otoño', 4: 'Invierno' };
      return seasons[food.selected_season_id] || 'Temporada desconocida';
    }
    return 'No especificada';
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">{food.name}</h2>
            {approvalInfo && (
              <span className={`text-sm px-3 py-1 rounded-full ${approvalInfo.bgColor} ${approvalInfo.color} font-medium`}>
                {approvalInfo.text}
              </span>
            )}
        </div>

      {food.created_at && (
        <div className="flex items-center text-sm text-gray-400">
          <Calendar className="w-4 h-4 mr-2" />
          Creado el {formatDate(food.created_at)}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Información Básica</h3>
            <div className="space-y-2 text-sm bg-[#282d34] p-4 rounded-lg">
              <div className="flex justify-between"><span className="text-gray-400">Grupo:</span><span className="text-white">{foodGroupNames}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Unidad:</span><span className="text-white">{food.food_unit === 'unidades' ? 'Unidades' : 'Gramos'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Temporada:</span><span className="text-white">{getSeasonName()}</span></div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Macronutrientes</h3>
            <div className="bg-[#282d34] p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center justify-between"><span className="flex items-center text-orange-400"><CaloriesIcon className="w-4 h-4 mr-2"/>Calorías</span><span className="font-mono font-bold text-orange-400">{Math.round(calories)} kcal</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center text-red-400"><ProteinIcon className="w-4 h-4 mr-2"/>Proteínas</span><span className="font-mono font-bold text-red-400">{Math.round(food.proteins || 0)}g</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center text-yellow-400"><CarbsIcon className="w-4 h-4 mr-2"/>Hidratos</span><span className="font-mono font-bold text-yellow-400">{Math.round(food.total_carbs || 0)}g</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center text-green-400"><FatsIcon className="w-4 h-4 mr-2"/>Grasas</span><span className="font-mono font-bold text-green-400">{Math.round(food.total_fats || 0)}g</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {sensitivityNames && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Sensibilidades</h3>
              <div className="bg-[#282d34] p-4 rounded-lg"><p className="text-orange-400 text-sm">{sensitivityNames}</p></div>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Micronutrientes</h3>
            <div className="bg-[#282d34] p-4 rounded-lg space-y-3">
              <div><span className="text-purple-400 font-medium text-sm">Vitaminas:</span><p className="text-gray-300 text-sm mt-1">{vitaminNames}</p></div>
              <div><span className="text-cyan-400 font-medium text-sm">Minerales:</span><p className="text-gray-300 text-sm mt-1">{mineralNames}</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodInfoView;