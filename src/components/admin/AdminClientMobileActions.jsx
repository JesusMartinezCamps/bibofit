import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Scale, UtensilsCrossed } from 'lucide-react';
import WeightLogDialog from '@/components/shared/WeightLogDialog';
import FreeMealDialog from '@/components/plans/FreeMealDialog';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

const AdminClientMobileActions = ({ userId }) => {
  const [isWeightLogOpen, setWeightLogOpen] = useState(false);
  const [isFreeMealOpen, setFreeMealOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleAssignRecipeClick = () => {
    toast({
      title: 'Selecciona una Plantilla',
      description: 'Serás redirigido para seleccionar y asignar una plantilla de receta.',
    });
    navigate('/admin/create-recipe');
  };
  
  const handleLogSaved = () => {
    toast({
        title: 'Éxito',
        description: 'Registro de peso guardado correctamente.'
    });
  }

  const handleMealAdded = () => {
      toast({
          title: 'Éxito',
          description: 'Comida libre añadida correctamente.'
      });
  }

  return (
    <>
      <div className="md:hidden sticky top-[64px] bg-[#282d34] z-20 p-2 my-4 w-full flex justify-around items-center border-y border-gray-700 shadow-lg">
        <Button size="sm" className="flex-1 mx-1 bg-purple-600 hover:bg-purple-700 text-white" onClick={handleAssignRecipeClick}>
          <Plus className="h-4 w-4 mr-1" /> Receta
        </Button>
        <Button size="sm" className="flex-1 mx-1 bg-gray-600 hover:bg-gray-700 text-white" variant="outline" onClick={() => setWeightLogOpen(true)}>
          <Scale className="h-4 w-4 mr-1" /> Peso
        </Button>
        <Button size="sm" className="flex-1 mx-1 bg-gray-600 hover:bg-gray-700 text-white" variant="outline" onClick={() => setFreeMealOpen(true)}>
          <UtensilsCrossed className="h-4 w-4 mr-1" /> C. Libre
        </Button>
      </div>

      <WeightLogDialog
        open={isWeightLogOpen}
        onOpenChange={setWeightLogOpen}
        userId={userId}
        selectedDate={new Date()}
        onLogSaved={handleLogSaved}
      />
       <FreeMealDialog
        open={isFreeMealOpen}
        onOpenChange={setFreeMealOpen}
        userId={userId}
        selectedDate={new Date()}
        onMealAdded={handleMealAdded}
      />
    </>
  );
};

export default AdminClientMobileActions;