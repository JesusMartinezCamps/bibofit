import React from 'react';
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
} from '@/components/ui/alert-dialog';
import FoodCardBase from '@/components/shared/food/FoodCardBase';
import FoodStatusBadge from '@/components/shared/food/FoodStatusBadge';

const FoodCard = ({ food, onSelect, isSelected, onDelete }) => {
  const shouldShowStatus =
    Boolean(food?.is_user_created || food?.isUserCreated) ||
    food?.status === 'pending' ||
    food?.moderation_status === 'needs_review';

  const resolveTabForFood = () => {
    if (food?.moderation_status === 'needs_review') return 'review';
    if (food?.status === 'rejected') return 'rejected';
    if (food?.status === 'approved_general' || food?.status === 'approved_private') return 'approved';
    return 'pending';
  };

  const handleStatusBadgeClick = (event) => {
    event.stopPropagation();

    const shouldNavigate = window.confirm('¿Quieres ir a la Solicitud del Alimento?');
    if (!shouldNavigate) return;

    const params = new URLSearchParams();
    if (food?.user_id) params.set('userId', String(food.user_id));
    if (food?.id) params.set('foodId', String(food.id));
    params.set('tab', resolveTabForFood());

    const destination = `/admin-panel/content/food-requests?${params.toString()}`;
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

    if (isMobile) {
      window.location.assign(destination);
      return;
    }

    window.open(destination, '_blank', 'noopener,noreferrer');
  };

  const statusBadge = shouldShowStatus ? (
    <button
      type="button"
      onClick={handleStatusBadgeClick}
      className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      aria-label="Ir a solicitud del alimento"
    >
      <FoodStatusBadge status={food.status} moderationStatus={food.moderation_status} />
    </button>
  ) : null;

  const headerAction = onDelete ? (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          onClick={(event) => {
            event.stopPropagation();
          }}
          className="shrink-0 rounded-full bg-red-600/90 text-white p-1 hover:bg-red-500 transition-colors"
          aria-label={`Eliminar ${food.name}`}
        >
          <X className="w-4 h-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
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
            onClick={() => onDelete(food.id, { confirmed: true, foodName: food.name })}
          >
            Sí, eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="relative h-full"
    >
      <FoodCardBase
        food={food}
        onClick={() => onSelect(food)}
        isSelected={isSelected}
        statusBadge={statusBadge}
        headerAction={headerAction}
      />
    </motion.div>
  );
};

export default FoodCard;
