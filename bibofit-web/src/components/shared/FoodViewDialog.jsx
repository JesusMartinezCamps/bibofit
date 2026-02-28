import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Leaf } from 'lucide-react';
import ProteinIcon from '@/components/icons/ProteinIcon';
import CarbsIcon from '@/components/icons/CarbsIcon';
import FatsIcon from '@/components/icons/FatsIcon';
import CaloriesIcon from '@/components/icons/CaloriesIcon';
import { Badge } from '@/components/ui/badge';
import NutrientSummary from '@/components/admin/recipes/NutrientSummary';

const FoodViewDialog = ({ open, onOpenChange, food, allVitamins, allMinerals }) => {
    const [isNutrientSummaryOpen, setIsNutrientSummaryOpen] = React.useState(false);
    
    const macros = React.useMemo(() => {
        if (!food) return { proteins: 0, carbs: 0, fats: 0, calories: 0 };
        const p = food.proteins_total || 0;
        const c = food.carbs_total || 0;
        const f = food.fats_total || 0;
        return {
            proteins: p,
            carbs: c,
            fats: f,
            calories: p * 4 + c * 4 + f * 9,
        };
    }, [food]);

    const foodNutrients = React.useMemo(() => {
        if (!food) return { vitaminIds: [], mineralIds: [] };
        const vitaminIds = new Set();
        const mineralIds = new Set();
        if (food.food_vitamins) {
            food.food_vitamins.forEach(v => vitaminIds.add(v.vitamins.id));
        }
        if (food.food_minerals) {
            food.food_minerals.forEach(m => mineralIds.add(m.minerals.id));
        }
        return { vitaminIds: Array.from(vitaminIds), mineralIds: Array.from(mineralIds) };
    }, [food]);

    if (!food) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#1a1e23] border-gray-700 text-white w-[95vw] max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <Leaf className="w-6 h-6 text-green-400" />
                        {food.name}
                    </DialogTitle>
                    <DialogDescription>
                        Información nutricional por 100g o unidad.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar pr-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-800/50 rounded-lg text-center">
                            <p className="text-sm text-gray-400">Grupo</p>
                            <p className="font-semibold text-white">{food.food_groups?.name || 'N/A'}</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded-lg text-center">
                            <p className="text-sm text-gray-400">Medida</p>
                            <p className="font-semibold text-white capitalize">{food.food_unit || 'gramos'}</p>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-green-400 mb-2">Resumen de Macros</h4>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                            <div className="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg"><CaloriesIcon className="w-5 h-5 text-orange-400" /> <span>{Math.round(macros.calories)} kcal</span></div>
                            <div className="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg"><ProteinIcon className="w-5 h-5 text-red-400" /> <span>{Math.round(macros.proteins)}g</span></div>
                            <div className="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg"><CarbsIcon className="w-5 h-5 text-yellow-400" /> <span>{Math.round(macros.carbs)}g</span></div>
                            <div className="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg"><FatsIcon className="w-5 h-5 text-green-400" /> <span>{Math.round(macros.fats)}g</span></div>
                        </div>
                    </div>
                    
                    {food.food_allergies && food.food_allergies.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-red-400 mb-2">Alergenos</h4>
                            <div className="flex flex-wrap gap-2">
                                {food.food_allergies.map(allergy => (
                                    <Badge key={allergy.allergies.id} variant="destructive">{allergy.allergies.name}</Badge>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {(allVitamins?.length > 0 || allMinerals?.length > 0) && (
                        <NutrientSummary 
                            isOpen={isNutrientSummaryOpen} 
                            onToggle={() => setIsNutrientSummaryOpen(p => !p)} 
                            allVitamins={allVitamins} 
                            allMinerals={allMinerals} 
                            recipeNutrients={foodNutrients} 
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default FoodViewDialog;