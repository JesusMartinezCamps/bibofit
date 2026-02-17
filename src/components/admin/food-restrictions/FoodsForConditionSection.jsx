import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, X, ChevronDown, Search, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const FoodsForConditionSection = ({ conditionId, foods, onUpdateFoods, relationType }) => {
    const { toast } = useToast();
    const [allFoods, setAllFoods] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

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
    
    const foodsToDisplay = useMemo(() => {
        return foods.filter(f => f.relation_type === relationType).sort((a,b) => a.food.name.localeCompare(b.food.name)) || [];
    }, [foods, relationType]);

    const filteredList = useMemo(() => {
        return foodsToDisplay.filter(f => f.food.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [foodsToDisplay, searchTerm]);
    
    const foodOptions = useMemo(() => {
        const currentFoodIds = new Set(foods.map(f => f.food.id));
        return allFoods
            .filter(f => !currentFoodIds.has(f.id))
            .map(f => ({ value: f.id, label: f.name }));
    }, [allFoods, foods]);

    const handleAddFood = async (foodId) => {
        if (!foodId) return;
        
        setIsLoading(true);
        const { data: newAssociation, error } = await supabase.from('food_medical_conditions').insert({
            food_id: foodId,
            condition_id: conditionId,
            relation_type: relationType,
        }).select('*, food:food_id(id, name)').single();

        if (error) {
            console.error("Supabase error:", error);
            toast({ title: 'Error', description: 'No se pudo asociar el alimento. ' + error.message, variant: 'destructive' });
        } else {
            onUpdateFoods(conditionId, newAssociation, 'add');
            toast({ title: 'Éxito', description: 'Alimento asociado correctamente.' });
        }
        setIsLoading(false);
        setIsAddDialogOpen(false);
    };

    const handleRemoveFood = async (foodId) => {
        setIsLoading(true);
        const { error } = await supabase.from('food_medical_conditions')
            .delete()
            .match({ food_id: foodId, condition_id: conditionId, relation_type: relationType });
            
        if (error) {
            toast({ title: 'Error', description: 'No se pudo desasociar el alimento.', variant: 'destructive' });
        } else {
            const foodToRemove = foodsToDisplay.find(f => f.food.id === foodId);
            onUpdateFoods(conditionId, foodToRemove, 'remove');
            toast({ title: 'Éxito', description: 'Alimento desasociado correctamente.' });
        }
        setIsLoading(false);
    };

    const isRecommended = relationType === 'recommended';
    const title = isRecommended ? 'Alimentos Recomendados' : 'Alimentos a Evitar';

    const triggerClasses = isRecommended 
        ? 'text-green-300 hover:text-green-200' 
        : 'text-red-300 hover:text-red-200';
    const buttonClasses = isRecommended 
        ? 'text-green-300 hover:text-green-200 hover:bg-green-500/10'
        : 'text-red-300 hover:text-red-200 hover:bg-red-500/10';
    const tagClasses = isRecommended
        ? "bg-green-900/70 border border-green-700/60 text-green-300/90"
        : "bg-red-900/70 border border-red-700/60 text-red-300/90";
    const Icon = isRecommended ? ThumbsUp : ThumbsDown;

    return (
        <div className="bg-slate-900/40 p-3 rounded-md border border-slate-700/50 w-full">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <div className="flex justify-between items-center">
                    <CollapsibleTrigger asChild>
                        <button className={cn("flex items-center font-semibold text-sm w-full text-left", triggerClasses)}>
                            <ChevronDown className={`w-5 h-5 mr-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                            {title} ({foodsToDisplay.length})
                        </button>
                    </CollapsibleTrigger>
                    <Button variant="ghost" size="sm" onClick={() => setIsAddDialogOpen(true)} className={buttonClasses}>
                        <Plus className="w-4 h-4 mr-2" /> Añadir
                    </Button>
                </div>
                <CollapsibleContent className="pt-4 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            type="text"
                            placeholder="Buscar en esta lista..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-slate-800/60 border-slate-700"
                        />
                    </div>
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <div className="flex flex-wrap gap-2">
                        {filteredList.length > 0 ? (
                            filteredList.map((item) => (
                                <span key={item.food.id} className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-md text-sm", tagClasses)}>
                                    <Icon className="w-3.5 h-3.5" />
                                    {item.food.name}
                                    <button onClick={() => handleRemoveFood(item.food.id)} className="rounded-full hover:bg-white/20 p-0.5">
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            ))
                        ) : (
                            <p className="text-sm text-gray-400 italic w-full text-center py-2">
                                {foodsToDisplay.length > 0 ? 'No se encontraron alimentos con ese nombre.' : 'No hay alimentos en esta lista.'}
                            </p>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>
             <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Añadir Alimento a {title}</DialogTitle>
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

export default FoodsForConditionSection;