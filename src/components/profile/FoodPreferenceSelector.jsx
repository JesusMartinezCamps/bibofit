import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Label } from "@/components/ui/label";
import { X, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SearchSelectionModal from '@/components/shared/SearchSelectionModal';

const FoodPreferenceSelector = ({ type, userId, foodOptions, selectedFoods, setSelectedFoods, allFoods }) => {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isPreferred = type === 'preferred';
  
  const label = isPreferred ? 'Alimentos Preferidos' : 'Alimentos que No Te Gustan';
  const labelColor = isPreferred ? 'text-green-400' : 'text-red-400';
  
  // Styling for the chips
  const chipClassName = isPreferred ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400";
  const chipButtonClassName = isPreferred ? "text-green-400 hover:text-white" : "text-red-400 hover:text-white";
  const tableName = isPreferred ? 'preferred_foods' : 'non_preferred_foods';

  const handleAddFood = async (food) => {
    if (!food) return;
    
    if (selectedFoods.some(f => f.id === food.id)) {
        toast({ title: 'Info', description: 'Este alimento ya está en la lista.', variant: 'default' });
        return;
    }

    try {
      const { error } = await supabase.from(tableName).insert({ user_id: userId, food_id: food.id });
      if (error) throw error;
      
      setSelectedFoods(prev => [...prev, food]);
      toast({ title: 'Éxito', description: `${food.name} añadido a la lista.` });
      setIsModalOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: `No se pudo añadir el alimento.`, variant: 'destructive' });
    }
  };

  const handleRemoveFood = async (foodId) => {
    try {
      const { error } = await supabase.from(tableName).delete().eq('user_id', userId).eq('food_id', foodId);
      if (error) throw error;
      
      setSelectedFoods(prev => prev.filter(f => f.id !== foodId));
      toast({ title: 'Éxito', description: 'Alimento eliminado de la lista.' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el alimento.', variant: 'destructive' });
    }
  };

  // Filter allFoods to exclude already selected items (in either list or banned)
  // We can reuse logic from foodOptions filtering passed from parent, but better to recalc here 
  // based on allFoods to ensure we have full objects.
  // The parent 'foodOptions' are already filtered for global exclusions (allergies, etc).
  // We need to match that filter.
  // To simplify, let's assume 'foodOptions' contains valid IDs. We filter 'allFoods' based on those IDs.
  
  const availableItems = useMemo(() => {
     const validIds = new Set(foodOptions.map(opt => String(opt.value)));
     return allFoods.filter(f => validIds.has(String(f.id)));
  }, [allFoods, foodOptions]);


  return (
    <div className={`space-y-4 p-4 rounded-lg ${isPreferred ? 'bg-green-900/20 border-green-500/30' : 'bg-[#47050526] border-red-500/30'} border flex flex-col h-full`}>
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
            <Label className={`${labelColor} font-semibold text-base`}>{label}</Label>
            <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className={isPreferred ? "border-green-500/50 text-green-400 bg-[hsl(119.08deg_69.96%_14.45%_/_0.58)] hover:bg-[hsl(119.08deg_69.96%_14.45%_/_0.58)] hover:text-gray-100" : "border-red-500/50 text-red-400 bg-[hsl(0deg_60%_11.41%_/_0.58)] hover:bg-[hsl(0deg_60%_11.41%_/_0.58)] hover:text-gray-100"}
                onClick={() => setIsModalOpen(true)}
            >
                <PlusCircle className="w-4 h-4 mr-2" /> Añadir
            </Button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mt-2 flex-1 content-start">
        {selectedFoods.length === 0 && <p className="text-gray-500 text-sm italic w-full">Lista vacía.</p>}
        {selectedFoods.map((food) => (
            <div key={food.id} className={`flex items-center px-3 py-1 rounded-full text-sm ${chipClassName}`}>
              <span>{food.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveFood(food.id)}
                className={`ml-2 ${chipButtonClassName}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
        ))}
      </div>

      <SearchSelectionModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen}
        title={isPreferred ? "Añadir Alimento Preferido" : "Añadir Alimento No Deseado"}
        searchPlaceholder="Buscar alimento..."
        items={availableItems}
        onSelect={handleAddFood}
      />
    </div>
  );
};

export default FoodPreferenceSelector;