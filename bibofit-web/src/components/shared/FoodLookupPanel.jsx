import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X } from 'lucide-react';

const FoodLookupPanel = ({
  title = 'Buscar Ingrediente',
  showHeader = true,
  onBack,
  searchTerm,
  onSearchTermChange,
  onSearchKeyDown,
  placeholder,
  helperText,
  showClearButton = false,
  onClearSearch,
  children,
}) => {
  return (
    <div className="space-y-4 h-full flex flex-col p-0">
      {showHeader && (
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeft size={20} />
          </Button>
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
      )}
      <div>
        <div className="relative">
          <Input
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            onKeyDown={onSearchKeyDown}
            className="input-field pr-10"
            autoFocus
          />
          {showClearButton && searchTerm?.trim() ? (
            <button
              type="button"
              onClick={() => (onClearSearch ? onClearSearch() : onSearchTermChange(''))}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
        {helperText ? <p className="text-[11px] text-muted-foreground mt-2">{helperText}</p> : null}
      </div>
      <div className="flex-1 overflow-y-auto styled-scrollbar-green -mr-2 pr-2">{children}</div>
    </div>
  );
};

export default FoodLookupPanel;
