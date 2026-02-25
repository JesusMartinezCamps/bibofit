import React from 'react';
import { Calendar, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import CaloriesIcon from '@/components/icons/CaloriesIcon';

const FoodCard = ({ 
  food, 
  onImport, 
  onReject, 
  onDelete, 
  onCardClick,
  allSensitivities, 
  showActions = true, 
  showDate = false, 
  showApprovalType = false 
}) => {
  const calories = (food.proteins || 0) * 4 + (food.total_carbs || 0) * 4 + (food.total_fats || 0) * 9;

  const sensitivityNames = React.useMemo(() => {
    if (!food.selected_allergies || !allSensitivities || food.selected_allergies.length === 0) {
      return null;
    }
    return food.selected_allergies
      .map(id => allSensitivities.find(allergy => allergy.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }, [food.selected_allergies, allSensitivities]);

  const foodGroupNames = React.useMemo(() => {
    if (!food.food_groups || food.food_groups.length === 0) {
      return 'Sin grupo';
    }
    return food.food_groups.map(group => group.name).join(', ');
  }, [food.food_groups]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getApprovalTypeInfo = () => {
    if (food.status === 'approved_general') {
      return { text: 'Aprobado General', color: 'text-green-400', bgColor: 'bg-green-900/30' };
    } else if (food.status === 'approved_private') {
      return { text: 'Aprobado Privado', color: 'text-purple-400', bgColor: 'bg-purple-900/30' };
    }
    return null;
  };

  const approvalInfo = getApprovalTypeInfo();

  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick(food);
    }
  };

  const handleButtonClick = (e, action, type) => {
    e.stopPropagation();
    if (action === 'import') {
      onImport(food, type);
    } else if (action === 'reject') {
      onReject(food.id);
    } else if (action === 'delete') {
      onDelete(food.id);
    }
  };

  return (
    <div 
      className="relative group bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 p-4 rounded-xl transition-all shadow-lg border border-slate-700/50 hover:shadow-purple-500/10 cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          {showDate && food.created_at && (
            <p className="text-sm text-gray-500 flex items-center mb-2">
              <Calendar className="w-4 h-4 mr-2" />
              {formatDate(food.created_at)}
            </p>
          )}
          <p className="font-semibold text-white text-lg">{food.name}</p>
          {sensitivityNames && (
            <p className="text-xs text-orange-400 mt-1">
              Sensibilidades: {sensitivityNames}
            </p>
          )}
          <p className="text-sm text-gray-400 mt-1">{foodGroupNames}</p>
        </div>
        
        <div className="flex flex-col items-end space-y-1">
          {food.status === 'rejected' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button 
                  className="p-1.5 bg-red-900/50 rounded-full text-red-400 hover:bg-red-800/70 hover:text-white transition-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  <XCircle size={18} />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar permanentemente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. El alimento "{food.name}" será eliminado para siempre.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(food.id)} className="bg-red-600 hover:bg-red-700">
                    Sí, eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {showApprovalType && approvalInfo && (
            <span className={`text-xs px-2 py-1 rounded-full ${approvalInfo.bgColor} ${approvalInfo.color} font-medium`}>
              {approvalInfo.text}
            </span>
          )}
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-start gap-x-6 text-sm font-mono">
        <span className="flex items-center text-orange-400" title="Calorías"><CaloriesIcon className="w-4 h-4 mr-1.5"/>{Math.round(calories)}</span>
        <span className="flex items-center text-red-400" title="Proteínas"><ProteinIcon className="w-4 h-4 mr-1.5"/>{Math.round(food.proteins || 0)}g</span>
        <span className="flex items-center text-yellow-400" title="Carbohidratos"><CarbsIcon className="w-4 h-4 mr-1.5"/>{Math.round(food.total_carbs || 0)}g</span>
        <span className="flex items-center text-green-400" title="Grasas"><FatsIcon className="w-4 h-4 mr-1.5"/>{Math.round(food.total_fats || 0)}g</span>
      </div>
      
      {showActions && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2" onClick={(e) => e.stopPropagation()}>
          {food.status === 'pending' && (
            <>
              <Button 
                onClick={(e) => handleButtonClick(e, 'import', 'general')} 
                size="sm" 
                className="bg-green-600 hover:bg-green-700"
              >
                Importar Alimento
              </Button>
              <Button 
                onClick={(e) => handleButtonClick(e, 'import', 'client')} 
                size="sm" 
                className="text-white transition-colors hover:bg-purple-700 bg-purple-600"
              >
                Importar sólo al Cliente
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="bg-red-600 hover:bg-red-700">
                    <XCircle className="w-4 h-4 mr-2" />Rechazar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se marcará la solicitud del alimento "{food.name}" como rechazada.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      className="bg-red-600 hover:bg-red-700" 
                      onClick={() => onReject(food.id)}
                    >
                      Sí, rechazar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {food.status === 'rejected' && (
            <>
              <Button 
                onClick={(e) => handleButtonClick(e, 'import', 'general')} 
                size="sm" 
                className="bg-green-600 hover:bg-green-700"
              >
                Importar Alimento
              </Button>
              <Button 
                onClick={(e) => handleButtonClick(e, 'import', 'client')} 
                size="sm" 
                className="text-white transition-colors hover:bg-purple-700 bg-purple-600"
              >
                Importar sólo al Cliente
              </Button>
              {/* The permanent delete button is now always visible and handled by the XCircle at the top right */}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FoodCard;