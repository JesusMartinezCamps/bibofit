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
    headerContent,
    filterFn,
    itemKey,
    renderItem,
    emptyText = 'No se encontraron resultados.'
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const normalizedSearch = searchTerm.toLowerCase().trim();

    const defaultFilterFn = (item, search) =>
        String(item?.[displayKey] ?? '')
            .toLowerCase()
            .includes(search);

    const defaultItemKey = (item) => item?.id;

    const defaultRenderItem = (item) => (
        <>
            <span className="text-gray-800 font-medium dark:text-gray-200">{item?.[displayKey]}</span>
            <Plus className="h-4 w-4 text-muted-foreground group-hover:text-green-400 transition-colors" />
        </>
    );

    const filteredItems = useMemo(() => {
        if (!normalizedSearch) return items;
        const appliedFilter = filterFn || defaultFilterFn;
        return items.filter((item) => appliedFilter(item, normalizedSearch));
    }, [items, normalizedSearch, filterFn, displayKey]);

    const resolveItemKey = itemKey || defaultItemKey;
    const resolveRenderItem = renderItem || defaultRenderItem;

    const handleSelect = (item) => {
        onSelect(item);
        setSearchTerm(''); // Reset search on select
        // Parent is responsible for closing the modal
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-background p-0 sm:left-1/2 sm:top-1/2 sm:h-[80vh] sm:w-[95%] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border sm:border-border">
                <div className="p-4 border-b border-border space-y-4 flex-shrink-0">
                    <DialogHeader>
                        <DialogTitle className="text-left">{title}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input 
                            placeholder={searchPlaceholder} 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-muted border-input text-foreground focus:border-cyan-500"
                        />
                        {headerContent}
                    </div>
                </div>
                <ScrollArea className="flex-1 p-2">
                    <div className="space-y-1">
                        {filteredItems.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8 text-sm">{emptyText}</p>
                        ) : (
                            filteredItems.map((item) => (
                                <button
                                    key={resolveItemKey(item)}
                                    onClick={() => handleSelect(item)}
                                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/80 transition-colors group text-left"
                                >
                                    {resolveRenderItem(item)}
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
