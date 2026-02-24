import React, { useState, useMemo } from "react";
    import { Check, ChevronsUpDown, X } from "lucide-react";

    import { cn } from "@/lib/utils";
    import { Button } from "@/components/ui/button";
    import {
      Command,
      CommandEmpty,
      CommandGroup,
      CommandInput,
      CommandItem,
      CommandList,
    } from "@/components/ui/command";
    import {
      Popover,
      PopoverContent,
      PopoverTrigger,
    } from "@/components/ui/popover";
    import { Badge }
from "@/components/ui/badge";

    const normalizeText = (text) => {
      if (!text) return '';
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    };

    export function Combobox({
      options,
      optionsGrouped,
      value, // For single selection
      onSelect, // For single selection and grouped options
      onValueChange, // For single selection
      selectedValues, // For multiple selection
      onSelectedValuesChange, // For multiple selection
      placeholder,
      searchPlaceholder,
      noResultsText,
      allYearOptionName = "Todo el año",
      keepOptionsOnSelect = false,
      triggerClassName,
      contentClassName,
      searchInputClassName,
      commandItemClassName,
      showSelectedBadges = true,
    }) {
      const [open, setOpen] = useState(false);

      const isMultiSelect = onSelectedValuesChange !== undefined;

      const handleSelect = (currentValue, label) => {
        setTimeout(() => {
          if (onSelect) {
            onSelect(currentValue, label);
            setOpen(false);
            return;
          }
  
          if (isMultiSelect) {
            const currentSelected = selectedValues || [];
            const newSelectedValues = currentSelected.includes(currentValue)
              ? currentSelected.filter((val) => val !== currentValue)
              : [...currentSelected, currentValue];
            onSelectedValuesChange(newSelectedValues);
            if (!keepOptionsOnSelect) {
              setOpen(false);
            }
          } else {
            onValueChange(currentValue === value ? "" : currentValue);
            setOpen(false);
          }
        }, 0);
      };

      const allOptions = useMemo(() => {
        if (optionsGrouped) {
          return Object.values(optionsGrouped).flat();
        }
        return options || [];
      }, [options, optionsGrouped]);

      const allYearOption = useMemo(() => {
        return allOptions.find(opt => opt.label === allYearOptionName);
      }, [allOptions, allYearOptionName]);

      const displayLabel = useMemo(() => {
        if (isMultiSelect) {
            const currentSelected = selectedValues || [];
            if (allYearOption && currentSelected.includes(allYearOption.value)) {
                return allYearOption.label;
            }
            if (currentSelected.length === 0) return placeholder;
            if (currentSelected.length === 1) {
                const selectedOption = allOptions.find(opt => opt.value === currentSelected[0]);
                return selectedOption ? selectedOption.label : placeholder;
            }
            return `${currentSelected.length} seleccionados`;
        } else {
            if (onSelect) return placeholder;
            const selectedOption = allOptions.find(opt => String(opt.value) === String(value));
            if (!selectedOption) {
                return <span className="text-gray-400">{placeholder}</span>;
            }
            const conflictClass = {
                sensitivity: "text-orange-200",
                condition_avoid: "text-red-200",
                hated: "text-red-200",
                condition_recommend: "text-green-200",
                preferred: "text-green-200",
            }[selectedOption.conflictType];

            return <span className={cn(conflictClass)}>{selectedOption.label}</span>;
        }
    }, [value, selectedValues, isMultiSelect, allOptions, placeholder, allYearOption, onSelect]);

      const renderCommandItems = (opts) => {
        return opts.map((option) => {
          const isSelected = isMultiSelect
            ? (selectedValues || []).includes(option.value)
            : String(value) === String(option.value);

          const conflictTextClass = {
            sensitivity: "text-orange-300",
            condition_avoid: "text-red-300",
            hated: "text-red-300",
            condition_recommend: "text-green-400",
            preferred: "text-green-400",
          }[option.conflictType];

          const conflictBgClass = {
            sensitivity: "aria-selected:bg-orange-800/80 data-[highlighted]:bg-orange-800/80",
            condition_avoid: "aria-selected:bg-red-800/80 data-[highlighted]:bg-red-800/80",
            hated: "aria-selected:bg-red-800/80 data-[highlighted]:bg-red-800/80",
            condition_recommend: "aria-selected:bg-green-800/80 data-[highlighted]:bg-green-800/80",
            preferred: "aria-selected:bg-green-800/80 data-[highlighted]:bg-green-800/80",
          }[option.conflictType];

          return (
            <CommandItem
              key={option.value}
              value={option.label}
              onSelect={() => handleSelect(option.value, option.label)}
              className={cn(
                "cursor-pointer",
                conflictBgClass,
                !conflictBgClass && "aria-selected:bg-gray-800/80 data-[highlighted]:bg-gray-800/80",
                isSelected ? conflictTextClass || "text-white" : conflictTextClass || "text-white",
                commandItemClassName,
                "hover:text-white" // Ensure text is white on hover
              )}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  isSelected && !onSelect ? "opacity-100" : "opacity-0"
                )}
              />
              {option.label}
            </CommandItem>
          );
        });
      };

      const selectedItems = useMemo(() => {
        if (!isMultiSelect) return [];
        const currentSelected = selectedValues || [];
        return currentSelected
          .map(val => allOptions.find(option => option.value === val))
          .filter(Boolean);
      }, [selectedValues, allOptions, isMultiSelect]);

      return (
        <div className="space-y-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={cn("w-full justify-between bg-gray-800 border-slate-700 hover:bg-gray-700 hover:text-white", triggerClassName)}
              >
                <span className="truncate">{displayLabel}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className={cn("w-[--radix-popover-trigger-width] p-0 bg-[#0F1627] border-slate-700", contentClassName)}>
              <Command className="bg-transparent" filter={(value, search) => {
                const normalizedValue = normalizeText(value);
                const normalizedSearch = normalizeText(search);
                return normalizedValue.includes(normalizedSearch) ? 1 : 0;
              }}>
                <CommandInput placeholder={searchPlaceholder} className={cn("h-9 border-0 border-b border-b-slate-700 ring-offset-0 focus:ring-0 text-white [&>svg]:hidden", searchInputClassName)} />
                <CommandList className="styled-scrollbar-green">
                  <CommandEmpty>{noResultsText}</CommandEmpty>
                  {optionsGrouped
                    ? Object.entries(optionsGrouped).map(([groupName, groupOptions]) => (
                        <CommandGroup key={groupName} heading={<span className="text-gray-400 font-semibold px-2">{groupName}</span>}>
                          {renderCommandItems(groupOptions)}
                        </CommandGroup>
                      ))
                    : renderCommandItems(allOptions)
                  }
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {isMultiSelect && showSelectedBadges && selectedItems.length > 0 && !(allYearOption && selectedValues.includes(allYearOption.value)) && (
            <div className="flex flex-wrap gap-1.5">
              {selectedItems.map(item => (
                <Badge key={item.value} variant="secondary" className="flex items-center gap-1.5 bg-gray-700 text-gray-200">
                  {item.label}
                  <button
                    type="button"
                    onClick={() => handleSelect(item.value)}
                    className="rounded-full hover:bg-white/20 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      );
    }