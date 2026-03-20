import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const normalizeText = (text) => {
  if (!text) return "";
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const isSubsequence = (needle, haystack) => {
  if (!needle) return true;
  let needleIdx = 0;
  for (let i = 0; i < haystack.length && needleIdx < needle.length; i += 1) {
    if (haystack[i] === needle[needleIdx]) {
      needleIdx += 1;
    }
  }
  return needleIdx === needle.length;
};

const scoreToken = (token, normalizedLabel) => {
  if (!token) return 0;
  if (normalizedLabel.startsWith(token)) return 0;
  if (normalizedLabel.includes(token)) return 1;
  if (isSubsequence(token, normalizedLabel)) return 2;
  return Number.POSITIVE_INFINITY;
};

const scoreOption = (option, normalizedQuery) => {
  if (!normalizedQuery) return 0;
  const normalizedLabel = normalizeText(option.label);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

  let score = 0;
  for (const token of tokens) {
    const tokenScore = scoreToken(token, normalizedLabel);
    if (!Number.isFinite(tokenScore)) {
      return Number.POSITIVE_INFINITY;
    }
    score += tokenScore;
  }
  return score;
};

const hasSelectedValue = (items = [], candidate) =>
  items.some((item) => String(item) === String(candidate));

const conflictTextClassByType = {
  sensitivity: "text-orange-300",
  individual_restriction: "text-red-300",
  condition_avoid: "text-red-300",
  hated: "text-red-300",
  condition_recommend: "text-green-400",
  preferred: "text-green-400",
};

const conflictRowClassByType = {
  sensitivity: "hover:bg-orange-800/60",
  individual_restriction: "hover:bg-red-800/60",
  condition_avoid: "hover:bg-red-800/60",
  hated: "hover:bg-red-800/60",
  condition_recommend: "hover:bg-green-800/60",
  preferred: "hover:bg-green-800/60",
};

export function Combobox({
  options,
  optionsGrouped,
  value,
  onSelect,
  onValueChange,
  selectedValues,
  onSelectedValuesChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  noResultsText = "No se encontraron resultados.",
  allYearOptionName = "Todo el año",
  keepOptionsOnSelect,
  triggerClassName,
  contentClassName,
  searchInputClassName,
  commandItemClassName,
  showSelectedBadges = true,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const optionRefs = useRef(new Map());

  const isMultiSelect = onSelectedValuesChange !== undefined;
  const shouldKeepOptionsOnSelect = keepOptionsOnSelect ?? isMultiSelect;
  const normalizedQuery = useMemo(() => normalizeText(query).trim(), [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(-1);
    }
  }, [open]);

  const allOptions = useMemo(() => {
    if (optionsGrouped) {
      return Object.values(optionsGrouped).flat();
    }
    return options || [];
  }, [options, optionsGrouped]);

  const allYearOption = useMemo(() => {
    return allOptions.find((opt) => opt.label === allYearOptionName);
  }, [allOptions, allYearOptionName]);

  const displayLabel = useMemo(() => {
    if (isMultiSelect) {
      const currentSelected = selectedValues || [];
      if (allYearOption && hasSelectedValue(currentSelected, allYearOption.value)) {
        return allYearOption.label;
      }
      if (currentSelected.length === 0) {
        return <span className="text-muted-foreground">{placeholder}</span>;
      }
      if (currentSelected.length === 1) {
        const selectedOption = allOptions.find(
          (opt) => String(opt.value) === String(currentSelected[0])
        );
        return selectedOption ? selectedOption.label : placeholder;
      }
      return `${currentSelected.length} seleccionados`;
    }

    if (onSelect) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    const selectedOption = allOptions.find((opt) => String(opt.value) === String(value));
    if (!selectedOption) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    const conflictClass = {
      sensitivity: "text-orange-200",
      individual_restriction: "text-red-200",
      condition_avoid: "text-red-200",
      hated: "text-red-200",
      condition_recommend: "text-green-200",
      preferred: "text-green-200",
    }[selectedOption.conflictType];

    return <span className={cn(conflictClass)}>{selectedOption.label}</span>;
  }, [allOptions, allYearOption, isMultiSelect, onSelect, placeholder, selectedValues, value]);

  const selectedItems = useMemo(() => {
    if (!isMultiSelect) return [];
    const currentSelected = selectedValues || [];
    return currentSelected
      .map((val) => allOptions.find((option) => String(option.value) === String(val)))
      .filter(Boolean);
  }, [allOptions, isMultiSelect, selectedValues]);

  const filteredFlatOptions = useMemo(() => {
    if (!normalizedQuery) return allOptions;

    const withScores = allOptions
      .map((option) => ({ option, score: scoreOption(option, normalizedQuery) }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.option.label.localeCompare(b.option.label, "es");
      });

    return withScores.map((entry) => entry.option);
  }, [allOptions, normalizedQuery]);

  const filteredGroupedOptions = useMemo(() => {
    if (!optionsGrouped) return null;
    const grouped = [];

    Object.entries(optionsGrouped).forEach(([groupName, groupOptions]) => {
      const filtered = normalizedQuery
        ? groupOptions
            .map((option) => ({ option, score: scoreOption(option, normalizedQuery) }))
            .filter((entry) => Number.isFinite(entry.score))
            .sort((a, b) => {
              if (a.score !== b.score) return a.score - b.score;
              return a.option.label.localeCompare(b.option.label, "es");
            })
            .map((entry) => entry.option)
        : groupOptions;

      if (filtered.length > 0) {
        grouped.push([groupName, filtered]);
      }
    });

    return grouped;
  }, [normalizedQuery, optionsGrouped]);

  const hasResults = optionsGrouped
    ? (filteredGroupedOptions || []).length > 0
    : filteredFlatOptions.length > 0;

  const visibleOptions = useMemo(() => {
    if (optionsGrouped) {
      return (filteredGroupedOptions || []).flatMap(([, groupOptions]) => groupOptions);
    }
    return filteredFlatOptions;
  }, [filteredFlatOptions, filteredGroupedOptions, optionsGrouped]);

  const optionIndexByValue = useMemo(() => {
    const indexMap = new Map();
    visibleOptions.forEach((option, index) => {
      const key = String(option.value);
      if (!indexMap.has(key)) {
        indexMap.set(key, index);
      }
    });
    return indexMap;
  }, [visibleOptions]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(visibleOptions.length > 0 ? 0 : -1);
  }, [open, normalizedQuery, visibleOptions.length]);

  useEffect(() => {
    if (!open || activeIndex < 0 || activeIndex >= visibleOptions.length) return;
    const activeOption = visibleOptions[activeIndex];
    const node = optionRefs.current.get(String(activeOption.value));
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, visibleOptions]);

  const handleSelect = (currentValue, label) => {
    if (disabled) return;

    if (onSelect) {
      onSelect(currentValue, label);
      setOpen(false);
      return;
    }

    if (isMultiSelect) {
      const currentSelected = selectedValues || [];
      const newSelectedValues = hasSelectedValue(currentSelected, currentValue)
        ? currentSelected.filter((val) => String(val) !== String(currentValue))
        : [...currentSelected, currentValue];

      onSelectedValuesChange(newSelectedValues);
      if (!shouldKeepOptionsOnSelect) {
        setOpen(false);
      }
      return;
    }

    if (onValueChange) {
      onValueChange(currentValue === value ? "" : currentValue);
    }
    setOpen(false);
  };

  const handleSearchKeyDown = (event) => {
    if (!open) return;

    if (event.key === "Enter") {
      if (activeIndex < 0 || activeIndex >= visibleOptions.length) return;
      event.preventDefault();
      const activeOption = visibleOptions[activeIndex];
      handleSelect(activeOption.value, activeOption.label);
      return;
    }

    if (event.key === "ArrowDown") {
      if (visibleOptions.length === 0) return;
      event.preventDefault();
      setActiveIndex((currentIndex) =>
        currentIndex < 0 ? 0 : (currentIndex + 1) % visibleOptions.length
      );
      return;
    }

    if (event.key === "ArrowUp") {
      if (visibleOptions.length === 0) return;
      event.preventDefault();
      setActiveIndex((currentIndex) =>
        currentIndex <= 0 ? visibleOptions.length - 1 : currentIndex - 1
      );
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  const renderOptionRow = (option) => {
    const isSelected = isMultiSelect
      ? hasSelectedValue(selectedValues || [], option.value)
      : String(value) === String(option.value);
    const optionIndex = optionIndexByValue.get(String(option.value)) ?? -1;
    const isActive = optionIndex === activeIndex;

    return (
      <button
        key={option.value}
        ref={(node) => {
          if (node) {
            optionRefs.current.set(String(option.value), node);
          } else {
            optionRefs.current.delete(String(option.value));
          }
        }}
        type="button"
        aria-selected={isActive}
        onMouseEnter={() => setActiveIndex(optionIndex)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => handleSelect(option.value, option.label)}
        className={cn(
          "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm text-foreground transition-colors",
          isActive && "bg-muted",
          conflictTextClassByType[option.conflictType],
          conflictRowClassByType[option.conflictType] || "hover:bg-muted",
          commandItemClassName
        )}
      >
        <Check className={cn("mr-2 h-4 w-4", isSelected && !onSelect ? "opacity-100" : "opacity-0")} />
        <span className="truncate">{option.label}</span>
      </button>
    );
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={(nextOpen) => !disabled && setOpen(nextOpen)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "flex min-h-[48px] w-full items-center justify-between rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground ring-offset-background transition-all duration-200 hover:border-primary/50 hover:bg-card/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/35 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
              triggerClassName
            )}
          >
            <span className="truncate text-left">{displayLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn(
            "bf-select-content w-[--radix-popover-trigger-width] border border-border bg-popover p-0 text-popover-foreground",
            contentClassName
          )}
        >
          <div className="flex h-11 items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              className={cn(
                "h-full w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground",
                searchInputClassName
              )}
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-1">
            {!hasResults ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{noResultsText}</p>
            ) : optionsGrouped ? (
              (filteredGroupedOptions || []).map(([groupName, groupOptions]) => (
                <div key={groupName} className="mb-1 last:mb-0">
                  <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{groupName}</p>
                  <div>{groupOptions.map(renderOptionRow)}</div>
                </div>
              ))
            ) : (
              filteredFlatOptions.map(renderOptionRow)
            )}
          </div>
        </PopoverContent>
      </Popover>

      {isMultiSelect &&
        showSelectedBadges &&
        selectedItems.length > 0 &&
        !(allYearOption && hasSelectedValue(selectedValues || [], allYearOption.value)) && (
          <div className="flex flex-wrap gap-1.5">
            {selectedItems.map((item) => (
              <Badge
                key={item.value}
                variant="secondary"
                className="flex items-center gap-1.5 border border-border bg-muted text-foreground"
              >
                {item.label}
                <button
                  type="button"
                  onClick={() => handleSelect(item.value)}
                  className="rounded-full p-0.5 hover:bg-foreground/15"
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
