import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, Plus } from 'lucide-react';
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
            <DialogContent className="w-[95%] max-w-md h-[80vh] flex flex-col p-0 bg-[#1a1e23] border-gray-700">
                <div className="p-4 border-b border-gray-700 space-y-4 flex-shrink-0">
                    <DialogHeader>
                        <DialogTitle className="text-left">{title}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                                placeholder={searchPlaceholder} 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-gray-800 border-gray-600 text-white focus:border-cyan-500"
                            />
                        </div>
                        {headerContent}
                    </div>
                </div>
                <ScrollArea className="flex-1 p-2">
                    <div className="space-y-1">
                        {filteredItems.length === 0 ? (
                            <p className="text-center text-gray-400 py-8 text-sm">No se encontraron resultados.</p>
                        ) : (
                            filteredItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/80 transition-colors group text-left"
                                >
                                    <span className="text-gray-200 font-medium">{item[displayKey]}</span>
                                    <Plus className="h-4 w-4 text-gray-500 group-hover:text-green-400 transition-colors" />
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