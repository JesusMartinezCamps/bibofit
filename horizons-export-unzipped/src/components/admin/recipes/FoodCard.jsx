import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
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

const FoodCard = ({ food, onSelect, isSelected, onDelete }) => {

  const calories = (food.proteins || 0) * 4 + (food.total_carbs || 0) * 4 + (food.total_fats || 0) * 9;

  const foodGroupsText = useMemo(() => {
    if (!food.food_groups || food.food_groups.length === 0) {
      return 'Sin grupo';
    }
    return food.food_groups.map(g => g.name).join(', ');
  }, [food.food_groups]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={`relative group h-full`}
      onClick={() => onSelect(food)}
    >
      <div className={`w-full h-full text-left bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 p-4 rounded-xl transition-all flex flex-col justify-between shadow-lg border ${isSelected ? 'border-green-500 ring-2 ring-green-500/50' : 'border-slate-700/50'} cursor-pointer hover:shadow-green-500/10`}>
        <div className="flex-1 pr-4">
          <h3 className="text-lg font-bold text-white truncate">{food.name}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {foodGroupsText}
            {food.season?.name && <span className="text-purple-400"> • {food.season.name}</span>}
          </p>
          {food.food_sensitivities && food.food_sensitivities.length > 0 && (
            <p className="text-xs text-orange-400 mt-1">
              Sensibilidades: {food.food_sensitivities.map(fa => fa.sensitivities?.name).filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between text-sm font-mono">
          <span className="flex items-center text-orange-400" title="Calorías"><CaloriesIcon className="w-4 h-4 mr-1.5"/>{Math.round(calories)}</span>
          <span className="flex items-center text-red-400" title="Proteínas"><ProteinIcon className="w-4 h-4 mr-1.5"/>{Math.round(food.proteins || 0)}g</span>
          <span className="flex items-center text-yellow-400" title="Carbohidratos"><CarbsIcon className="w-4 h-4 mr-1.5"/>{Math.round(food.total_carbs || 0)}g</span>
          <span className="flex items-center text-green-400" title="Grasas"><FatsIcon className="w-4 h-4 mr-1.5"/>{Math.round(food.total_fats || 0)}g</span>
        </div>
      </div>
      {onDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="absolute -top-2 -right-2 bg-red-600/90 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 z-10"
            >
              <X className="w-4 h-4" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente el alimento "{food.name}" y todas sus referencias en recetas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => onDelete(food.id)}
              >
                Sí, eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </motion.div>
  );
};

export default FoodCard;