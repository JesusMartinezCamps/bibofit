import React from 'react';
import { XCircle } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import FoodCardBase from '@/components/shared/food/FoodCardBase';
import FoodStatusBadge from '@/components/shared/food/FoodStatusBadge';

const FoodCard = ({
  food,
  onImport,
  onReject,
  onDelete,
  onCardClick,
  allSensitivities,
  showActions = true,
  showDate = false,
  showApprovalType = false,
}) => {
  const shouldShowStatus =
    showApprovalType ||
    food?.status === 'pending' ||
    food?.status === 'rejected' ||
    food?.moderation_status === 'needs_review';

  const statusBadge = shouldShowStatus ? (
    <FoodStatusBadge status={food?.status} moderationStatus={food?.moderation_status} />
  ) : null;

  const rejectedDeleteAction = food?.status === 'rejected' && onDelete ? (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          className="p-1.5 bg-red-900/50 rounded-full text-red-400 hover:bg-red-800/70 hover:text-foreground transition-all"
          onClick={(event) => event.stopPropagation()}
          aria-label={`Eliminar ${food.name}`}
        >
          <XCircle size={18} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
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
  ) : null;

  const footerActions = showActions ? (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {food?.status === 'pending' && (
        <>
          <Button
            onClick={(event) => {
              event.stopPropagation();
              onImport(food, 'general');
            }}
            size="sm"
            className="bg-green-600 hover:bg-green-700"
          >
            Importar Alimento
          </Button>
          <Button
            onClick={(event) => {
              event.stopPropagation();
              onImport(food, 'client');
            }}
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
            <AlertDialogContent onClick={(event) => event.stopPropagation()}>
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
      {food?.status === 'rejected' && (
        <>
          <Button
            onClick={(event) => {
              event.stopPropagation();
              onImport(food, 'general');
            }}
            size="sm"
            className="bg-green-600 hover:bg-green-700"
          >
            Importar Alimento
          </Button>
          <Button
            onClick={(event) => {
              event.stopPropagation();
              onImport(food, 'client');
            }}
            size="sm"
            className="text-white transition-colors hover:bg-purple-700 bg-purple-600"
          >
            Importar sólo al Cliente
          </Button>
          <div />
        </>
      )}
    </div>
  ) : null;

  return (
    <FoodCardBase
      food={food}
      onClick={() => onCardClick?.(food)}
      showDate={showDate}
      statusBadge={statusBadge}
      headerAction={rejectedDeleteAction}
      footerActions={footerActions}
      allSensitivities={allSensitivities}
    />
  );
};

export default FoodCard;
