import React, { useState, useMemo } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { motion } from 'framer-motion';

    const AddIngredientModal = ({ open, onOpenChange, onAddIngredient, availableFoods, currentIngredients }) => {
        const [searchTerm, setSearchTerm] = useState('');

        const filteredFoods = useMemo(() => {
            if (!searchTerm) return [];
            const lowercasedTerm = searchTerm.toLowerCase();
            const currentIngredientIds = new Set(currentIngredients.map(ing => ing.food_id));
            
            return availableFoods
                .filter(food => 
                    !currentIngredientIds.has(food.id) && 
                    food.name.toLowerCase().includes(lowercasedTerm)
                )
                .slice(0, 50);
        }, [searchTerm, availableFoods, currentIngredients]);

        const handleSelectFood = (food) => {
            onAddIngredient(food);
            setSearchTerm('');
        };

        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="bg-[#1a1e23] border-gray-700 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-green-400">Añadir Ingrediente</DialogTitle>
                        <DialogDescription>Busca un alimento para añadirlo a la receta.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            type="text"
                            placeholder="Buscar alimento..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field"
                        />
                        <ScrollArea className="mt-4 h-72">
                            <div className="space-y-1 pr-2">
                                {filteredFoods.map(food => (
                                    <motion.div
                                        key={food.id}
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                        onClick={() => handleSelectFood(food)}
                                        className="p-3 cursor-pointer rounded-md hover:bg-gray-700/50"
                                    >
                                        {food.name}
                                    </motion.div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>
        );
    };

    export default AddIngredientModal;