import React, { useState } from 'react';
import { ChevronDown, Palette } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const ColorLegendCollapsible = ({ items = [], className }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn('rounded-xl border border-border/70 bg-card/75', className)}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/35 rounded-xl"
          aria-label={isOpen ? 'Ocultar info de los colores' : 'Mostrar info de los colores'}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Palette className="h-4 w-4 text-muted-foreground" />
            Info de los colores
          </span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen ? 'rotate-180' : 'rotate-0')} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-muted-foreground">
              <span className={cn('h-2.5 w-2.5 rounded-full', item.dotClassName)} />
              {item.label}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ColorLegendCollapsible;
