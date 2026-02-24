import React from 'react';
    import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
    import { ChevronDown, ChevronUp } from 'lucide-react';
    import { cn } from '@/lib/utils';

    const FoodFormSection = ({ title, icon, children, borderColor, className, isCollapsible = false, forceOpen, onOpenChange }) => {
      const [isOpen, setIsOpen] = React.useState(!isCollapsible || forceOpen);

      React.useEffect(() => {
        if (forceOpen !== undefined) {
          setIsOpen(forceOpen);
        }
      }, [forceOpen]);

      const handleOpenChange = (open) => {
        if (onOpenChange) {
          onOpenChange(open);
        }
        setIsOpen(open);
      };
      
      const content = (
        <div className={cn("bg-gray-900/40 border rounded-lg overflow-hidden", borderColor, className)}>
          <div className={cn(
              "flex items-center p-4",
              isCollapsible ? "cursor-pointer" : ""
          )}>
            {icon && React.cloneElement(icon, { className: "mr-3 h-6 w-6" })}
            <h2 className="text-xl font-bold text-white flex-grow">{title}</h2>
            {isCollapsible && (isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />)}
          </div>
          <div className="p-4 pt-0">
              {children}
          </div>
        </div>
      );

      if (isCollapsible) {
        return (
          <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
            <CollapsibleTrigger asChild>
                <div className={cn("bg-gray-900/40 border rounded-lg overflow-hidden", borderColor, className)}>
                    <div className="flex items-center p-4 cursor-pointer">
                        {icon && React.cloneElement(icon, { className: "mr-3 h-6 w-6" })}
                        <h2 className="text-xl font-bold text-white flex-grow">{title}</h2>
                        {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className={cn("bg-gray-900/40 border border-t-0 rounded-b-lg -mt-2", borderColor)}>
                <div className="p-4">
                  {children}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      }
      
      return (
        <div className={cn("bg-gray-900/40 border rounded-lg overflow-hidden", borderColor, className)}>
          <div className="flex items-center p-4">
            {icon && React.cloneElement(icon, { className: "mr-3 h-6 w-6" })}
            <h2 className="text-xl font-bold text-white flex-grow">{title}</h2>
          </div>
          <div className="p-4 pt-0">
            {children}
          </div>
        </div>
      );
    };

    export default FoodFormSection;