import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const SearchSelectionModal = ({ 
    open, 
    onOpenChange, 
    title, 
    searchPlaceholder, 
    items, 
    onSelect,
    displayKey = 'name',
    headerContent
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredItems = useMemo(() => {
        if (!searchTerm) return items;
        return items.filter(item => 
            String(item[displayKey]).toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [items, searchTerm, displayKey]);

    const handleSelect = (item) => {
        onSelect(item);
        setSearchTerm(''); // Reset search on select
        // Parent is responsible for closing the modal
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95%] max-w-md h-[80vh] flex flex-col p-0 bg-background border-border">
                <div className="p-4 border-b border-border space-y-4 flex-shrink-0">
                    <DialogHeader>
                        <DialogTitle className="text-left">{title}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input 
                            placeholder={searchPlaceholder} 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-muted border-input text-white focus:border-cyan-500"
                        />
                        {headerContent}
                    </div>
                </div>
                <ScrollArea className="flex-1 p-2">
                    <div className="space-y-1">
                        {filteredItems.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8 text-sm">No se encontraron resultados.</p>
                        ) : (
                            filteredItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/80 transition-colors group text-left"
                                >
                                    <span className="text-gray-200 font-medium">{item[displayKey]}</span>
                                    <Plus className="h-4 w-4 text-muted-foreground group-hover:text-green-400 transition-colors" />
                                </button>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default SearchSelectionModal;
