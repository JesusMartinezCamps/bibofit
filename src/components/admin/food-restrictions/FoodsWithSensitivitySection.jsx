import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, X, ChevronDown, Search, ThumbsDown } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';

const FoodsWithSensitivitySection = ({ sensitivity, onUpdateFoods }) => {
    const { toast } = useToast();
    const [foods, setFoods] = useState(sensitivity.foods || []);
    const [isLoading, setIsLoading] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [allFoods, setAllFoods] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        setFoods(sensitivity.foods || []);
    }, [sensitivity.foods]);

    useEffect(() => {
        const fetchAllFoods = async () => {
            const { data, error } = await supabase.from('food').select('id, name').order('name');
            if (error) {
                toast({ title: "Error", description: "No se pudieron cargar los alimentos.", variant: "destructive" });
            } else {
                setAllFoods(data);
            }
        };
        fetchAllFoods();
    }, [toast]);
    
    const foodOptions = useMemo(() => {
        const currentFoodIds = new Set(foods.map(f => f.id));
        return allFoods
            .filter(f => !currentFoodIds.has(f.id))
            .map(f => ({ value: f.id, label: f.name }));
    }, [allFoods, foods]);

    const filteredFoods = useMemo(() => {
        return foods
            .filter(food => food.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [foods, searchTerm]);

    const handleAddFood = async (foodId) => {
        if (!foodId) return;

        const foodToAdd = allFoods.find(f => f.id === foodId);
        if (!foodToAdd) return;

        setIsLoading(true);
        const { error } = await supabase.from('food_sensitivities').insert({
            food_id: foodId,
            sensitivity_id: sensitivity.id,
        });

        if (error) {
            toast({ title: 'Error', description: 'No se pudo asociar el alimento.', variant: 'destructive' });
        } else {
            onUpdateFoods(sensitivity.id, foodToAdd, 'add-food');
            toast({ title: 'Éxito', description: 'Alimento asociado correctamente.' });
        }
        setIsLoading(false);
        setIsAddDialogOpen(false);
    };

    const handleRemoveFood = async (foodId) => {
        setIsLoading(true);
        const foodToRemove = foods.find((f) => f.id === foodId);

        const { error } = await supabase
            .from('food_sensitivities')
            .delete()
            .match({ food_id: foodId, sensitivity_id: sensitivity.id });

        if (error) {
            toast({ title: 'Error', description: 'No se pudo desasociar el alimento.', variant: 'destructive' });
        } else {
            onUpdateFoods(sensitivity.id, foodToRemove, 'remove-food');
            toast({ title: 'Éxito', description: 'Alimento desasociado correctamente.' });
        }
        setIsLoading(false);
    };

    return (
        <div className="bg-slate-900/40 p-3 rounded-md border border-slate-700/50 w-full mt-3">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <div className="flex justify-between items-center">
                    <CollapsibleTrigger asChild>
                        <button className="flex items-center text-orange-300 font-semibold text-sm w-full text-left">
                            <ChevronDown className={`w-5 h-5 mr-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                            Alimentos a Evitar Asociados ({foods.length})
                        </button>
                    </CollapsibleTrigger>
                    <Button variant="ghost" size="sm" onClick={() => setIsAddDialogOpen(true)} className="text-orange-300 hover:text-orange-200 hover:bg-orange-500/10">
                        <Plus className="w-4 h-4 mr-2" /> Añadir
                    </Button>
                </div>
                <CollapsibleContent className="pt-4 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            type="text"
                            placeholder="Buscar alimento en la lista..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-slate-800/60 border-slate-700"
                        />
                    </div>
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin text-orange-400" />}
                    <div className="flex flex-wrap gap-2">
                        {filteredFoods.length > 0 ? (
                            filteredFoods.map((food) => (
                                <span
                                    key={food.id}
                                    className="flex items-center gap-1.5 bg-red-900/70 border border-red-700/60 text-red-300/90 px-2 py-0.5 rounded-md text-sm"
                                >
                                    <ThumbsDown className="w-3.5 h-3.5" />
                                    {food.name}
                                    <button onClick={() => handleRemoveFood(food.id)} className="rounded-full hover:bg-white/20 p-0.5">
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ))
                        ) : (
                            <p className="text-sm text-gray-400 italic w-full text-center py-2">
                                {foods.length > 0 ? 'No se encontraron alimentos con ese nombre.' : 'No hay alimentos asociados a esta sensibilidad.'}
                            </p>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Añadir Alimento a {sensitivity.name}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Combobox
                            options={foodOptions}
                            onSelect={(value) => handleAddFood(value)}
                            placeholder="Buscar y seleccionar alimento..."
                            searchPlaceholder="Escribe para buscar..."
                            noResultsText="No se encontraron alimentos."
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline-dark">Cancelar</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default FoodsWithSensitivitySection;