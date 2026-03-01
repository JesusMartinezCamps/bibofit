import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const FoodLookupPanel = ({
  title = 'Buscar Ingrediente',
  showHeader = true,
  onBack,
  searchTerm,
  onSearchTermChange,
  onSearchKeyDown,
  placeholder,
  helperText,
  children,
}) => {
  return (
    <div className="space-y-4 h-full flex flex-col p-0">
      {showHeader && (
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-gray-400 hover:bg-slate-800 hover:text-white">
            <ArrowLeft size={20} />
          </Button>
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
      )}
      <div>
        <Input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
          className="input-field"
          autoFocus
        />
        {helperText ? <p className="text-[11px] text-gray-400 mt-2">{helperText}</p> : null}
      </div>
      <div className="flex-1 overflow-y-auto styled-scrollbar-green -mr-2 pr-2">{children}</div>
    </div>
  );
};

export default FoodLookupPanel;
