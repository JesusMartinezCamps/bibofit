import React, { useMemo } from 'react';
import { Calendar, CheckCircle, Info, XCircle, UtensilsCrossed, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

const FreeMealCard = ({ 
  freeMeal, 
  onReview,
  onDelete
}) => {
  
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusInfo = () => {
    switch (freeMeal.status) {
      case 'approved_general':
        return { text: 'Plantilla General', icon: <CheckCircle className="w-3 h-3"/>, classes: 'bg-green-500/20 text-green-300 border-green-500/30' };
      case 'approved_private':
        return { text: 'Receta Privada', icon: <CheckCircle className="w-3 h-3"/>, classes: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
      case 'rejected':
        return { text: 'Rechazado', icon: <XCircle className="w-3 h-3"/>, classes: 'bg-red-500/20 text-red-300 border-red-500/30' };
      case 'kept_as_free_recipe':
        return { text: 'Receta Libre', icon: <UtensilsCrossed className="w-3 h-3"/>, classes: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
      default: // pending
        return { text: 'Pendiente', icon: <Info className="w-3 h-3"/>, classes: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' };
    }
  };

  const formatIngredients = useMemo(() => {
    return freeMeal.ingredients.map(ing => {
      const unit = ing.food_unit === 'unidades' ? 'Uds.' : 'g';
      return `${ing.food_name} (${Math.round(ing.grams)} ${unit})`;
    }).join(', ');
  }, [freeMeal.ingredients]);
  
  const statusInfo = getStatusInfo();
  
  return (
    <div 
      className="relative group bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 p-4 rounded-xl transition-all shadow-lg border border-slate-700/50 hover:shadow-cyan-500/10 hover:border-cyan-500/50 cursor-pointer"
      onClick={() => onReview(freeMeal)}
    >
      <div className="flex justify-between items-center mb-2">
        {freeMeal.created_at && (
            <p className="text-sm text-gray-500 flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            {formatDate(freeMeal.created_at)}
            </p>
        )}
          <Badge variant="outline" className={cn("flex items-center gap-1.5", statusInfo.classes)}>
            {statusInfo.icon}
            {statusInfo.text}
        </Badge>
      </div>
      
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="font-semibold text-white text-lg">{freeMeal.name}</p>
          <p className="text-sm text-gray-400 mt-1">{freeMeal.day_meal?.name || 'Comida'}</p>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-gray-700">
        <p className="text-sm font-semibold text-gray-300 mb-2">Ingredientes:</p>
        <p className="text-sm text-gray-400 italic leading-relaxed">
            {formatIngredients}
        </p>
      </div>

      {freeMeal.status === 'rejected' && onDelete && (
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(freeMeal.id); }} 
          className="absolute -top-2 -right-2 bg-red-600/90 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
          title="Eliminar permanentemente"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default FreeMealCard;