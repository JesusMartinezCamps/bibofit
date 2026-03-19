import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Label } from "@/components/ui/label";
import { X, PlusCircle, Check, CircleAlert, CircleCheck, Layers, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { getConflictInfo } from '@/lib/restrictionChecker';
import { PREFERENCE_TONES } from '@/components/profile/preferenceToneStyles';

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeRelationType = (value = '') => normalizeText(value).replace(/\s+/g, '_');

const isAvoidRelation = (relationType) => {
  const relation = normalizeRelationType(relationType);
  return relation === 'to_avoid'
    || relation === 'evitar'
    || relation === 'contraindicated'
    || relation === 'contraindicado'
    || relation === 'not_recommended'
    || relation === 'no_recomendado';
};

const isRecommendRelation = (relationType) => {
  const relation = normalizeRelationType(relationType);
  return relation === 'recommended'
    || relation === 'recomendado'
    || relation === 'recommend';
};

// Mapeo de tipo de conflicto → estilos del badge
const CONFLICT_BADGE_CONFIG = {
  sensitivity:         { icon: AlertTriangle, className: 'border-red-500/50 text-red-300' },
  individual_restriction: { icon: AlertTriangle, className: 'border-red-500/50 text-red-300' },
  condition_avoid:     { icon: CircleAlert,   className: 'border-red-500/50 text-red-300' },
  condition_recommend: { icon: CircleCheck,   className: 'border-emerald-500/50 text-emerald-300' },
  diet_type_excluded:  { icon: AlertTriangle, className: 'border-red-500/50 text-red-300' },
  diet_type_limited:   { icon: AlertTriangle, className: 'border-orange-500/50 text-orange-300' },
};

const FoodPreferenceSelector = ({
  type,
  userId,
  foodOptions,
  selectedFoods,
  setSelectedFoods,
  allFoods,
  selectedConditionIds = [],
  userRestrictions = null,
}) => {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroupIds, setExpandedGroupIds] = useState(new Set());
  const isPreferred = type === 'preferred';
  const tone = isPreferred ? PREFERENCE_TONES.green : PREFERENCE_TONES.red;
  
  const label = isPreferred ? 'Alimentos Preferidos' : 'Alimentos que No Te Gustan';
  const labelColor = tone.title;
  
  // Styling for the chips
  const chipClassName = tone.selectedBadge;
  const chipButtonClassName = tone.selectedAction;
  const tableName = isPreferred ? 'preferred_foods' : 'non_preferred_foods';

  const handleAddFood = async (food) => {
    if (!food) return;
    
    if (selectedFoods.some(f => f.id === food.id)) {
        toast({ title: 'Info', description: 'Este alimento ya está en la lista.', variant: 'default' });
        return false;
    }

    try {
      const { error } = await supabase.from(tableName).insert({ user_id: userId, food_id: food.id });
      if (error) throw error;
      
      setSelectedFoods(prev => [...prev, food]);
      toast({ title: 'Éxito', description: `${food.name} añadido a la lista.`, variant: 'success' });
      return true;
    } catch (error) {
      toast({ title: 'Error', description: `No se pudo añadir el alimento.`, variant: 'destructive' });
      return false;
    }
  };

  const handleRemoveFood = async (foodId) => {
    try {
      const { error } = await supabase.from(tableName).delete().eq('user_id', userId).eq('food_id', foodId);
      if (error) throw error;

      setSelectedFoods(prev => prev.filter(f => f.id !== foodId));
      toast({ title: 'Éxito', description: 'Alimento eliminado de la lista.', variant: 'success' });
      return true;
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el alimento.', variant: 'destructive' });
      return false;
    }
  };

  const handleBatchAddFoods = async (foods) => {
    const newFoods = foods.filter(food => !selectedFoodIds.has(String(food.id)));
    if (newFoods.length === 0) return;
    try {
      const inserts = newFoods.map(food => ({ user_id: userId, food_id: food.id }));
      const { error } = await supabase.from(tableName).insert(inserts);
      if (error) throw error;
      setSelectedFoods(prev => [...prev, ...newFoods]);
      toast({ title: 'Éxito', description: `${newFoods.length} alimentos añadidos.`, variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron añadir los alimentos.', variant: 'destructive' });
    }
  };

  const handleBatchRemoveFoods = async (foods) => {
    const toRemove = foods.filter(food => selectedFoodIds.has(String(food.id)));
    if (toRemove.length === 0) return;
    const idsToRemove = toRemove.map(f => f.id);
    try {
      const { error } = await supabase.from(tableName).delete().eq('user_id', userId).in('food_id', idsToRemove);
      if (error) throw error;
      setSelectedFoods(prev => prev.filter(f => !idsToRemove.includes(f.id)));
      toast({ title: 'Éxito', description: `${toRemove.length} alimentos eliminados.`, variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron eliminar los alimentos.', variant: 'destructive' });
    }
  };

  const selectedFoodIds = useMemo(
    () => new Set(selectedFoods.map(food => String(food.id))),
    [selectedFoods]
  );

  const conditionIdsSet = useMemo(
    () => new Set(selectedConditionIds.map(id => String(id))),
    [selectedConditionIds]
  );

  const getFoodGroupNames = (food) => {
    const groups = food?.food_to_food_groups || [];
    return groups
      .map((entry) => entry?.food_group?.name || entry?.food_groups?.name || entry?.food_group_name)
      .filter(Boolean);
  };

  const getFoodConditionInfo = (food) => {
    if (!conditionIdsSet.size) return null;
    const relations = food?.food_medical_conditions || [];
    if (!relations.length) return null;

    const avoidedBy = [];
    const recommendedBy = [];

    relations.forEach((entry) => {
      const conditionId = entry?.condition_id ?? entry?.medical_conditions?.id ?? entry?.condition?.id;
      if (!conditionIdsSet.has(String(conditionId))) return;
      const conditionName = entry?.medical_conditions?.name || entry?.condition?.name || 'Condición';

      if (isAvoidRelation(entry?.relation_type)) {
        avoidedBy.push(conditionName);
        return;
      }
      if (isRecommendRelation(entry?.relation_type)) {
        recommendedBy.push(conditionName);
      }
    });

    if (avoidedBy.length > 0 && recommendedBy.length > 0) {
      return {
        variant: 'mixed',
        label: `Mixto: evitar por ${avoidedBy.join(', ')}; recomendado por ${recommendedBy.join(', ')}`
      };
    }
    if (avoidedBy.length > 0) {
      return { variant: 'avoid', label: `No recomendado: ${avoidedBy.join(', ')}` };
    }
    if (recommendedBy.length > 0) {
      return { variant: 'recommend', label: `Recomendado: ${recommendedBy.join(', ')}` };
    }

    return null;
  };

  const availableItems = useMemo(() => {
    const validIds = new Set(foodOptions.map(opt => String(opt.value)));
    return allFoods
      .filter(food => validIds.has(String(food.id)) || selectedFoodIds.has(String(food.id)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allFoods, foodOptions, selectedFoodIds]);

  const filteredItems = useMemo(() => {
    const query = normalizeText(searchTerm);
    if (!query) return availableItems;
    return availableItems.filter((food) => {
      const foodName = normalizeText(food.name);
      if (foodName.includes(query)) return true;
      return getFoodGroupNames(food).some(group => normalizeText(group).includes(query));
    });
  }, [availableItems, searchTerm]);

  const groupedItems = useMemo(() => {
    const groupMap = new Map();

    filteredItems.forEach((food) => {
      const groups = food.food_to_food_groups || [];

      if (groups.length === 0) {
        const fallbackId = 'ungrouped';
        if (!groupMap.has(fallbackId)) {
          groupMap.set(fallbackId, { id: fallbackId, name: 'Sin grupo', foods: [] });
        }
        groupMap.get(fallbackId).foods.push(food);
        return;
      }

      groups.forEach((fg) => {
        const groupId = fg.food_group_id ?? fg.food_group?.id ?? fg.food_groups?.id;
        const groupName = fg.food_groups?.name ?? fg.food_group?.name;
        if (!groupId || !groupName) return;
        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, { id: groupId, name: groupName, foods: [] });
        }
        groupMap.get(groupId).foods.push(food);
      });
    });

    return Array.from(groupMap.values())
      .map((group) => ({
        ...group,
        foods: group.foods.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredItems]);

  const toggleGroupExpanded = (groupId) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleToggleGroupFoods = async (groupFoods) => {
    const allSelected = groupFoods.length > 0 && groupFoods.every((f) => selectedFoodIds.has(String(f.id)));
    if (allSelected) {
      await handleBatchRemoveFoods(groupFoods);
    } else {
      await handleBatchAddFoods(groupFoods);
    }
  };

  const handleToggleFood = async (food) => {
    if (!food) return;
    if (selectedFoodIds.has(String(food.id))) {
      await handleRemoveFood(food.id);
      return;
    }
    await handleAddFood(food);
  };


  return (
    <div className={`space-y-4 p-4 rounded-lg border flex flex-col h-full ${tone.container}`}>
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
            <Label className={`${labelColor} font-semibold text-base`}>{label}</Label>
            <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className={tone.addButton}
                onClick={() => setIsModalOpen(true)}
            >
                <PlusCircle className="w-4 h-4 mr-2" /> Añadir
            </Button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mt-2 flex-1 content-start">
        {selectedFoods.length === 0 && <p className="text-muted-foreground text-sm italic w-full">Lista vacía.</p>}
        {selectedFoods.map((food) => (
            <div key={food.id} className={`flex items-center px-3 py-1 rounded-full text-sm ${chipClassName}`}>
              <span>{food.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveFood(food.id)}
                className={`ml-2 ${chipButtonClassName}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
        ))}
      </div>

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setSearchTerm('');
            setExpandedGroupIds(new Set());
          }
        }}
      >
        <DialogContent className="w-[95%] max-w-xl h-[80vh] flex flex-col p-0 bg-background border-border">
          <div className="p-4 border-b border-border space-y-4 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-left">
                {isPreferred ? 'Seleccionar Alimentos Preferidos' : 'Seleccionar Alimentos No Deseados'}
              </DialogTitle>
            </DialogHeader>
            <div className="relative">
              <Input
                placeholder="Buscar alimento o grupo (ej: verduras)..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="bg-muted border-input text-foreground focus:border-cyan-500 pr-8"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 p-2">
            <div className="space-y-1">
              {groupedItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No se encontraron resultados.</p>
              ) : (
                <>
                  <p className="px-3 py-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Grupos</p>
                  {groupedItems.map((group) => {
                    const groupFoods = group.foods;
                    const selectedCount = groupFoods.filter((f) => selectedFoodIds.has(String(f.id))).length;
                    const total = groupFoods.length;
                    const isFullySelected = total > 0 && selectedCount === total;
                    const isPartial = selectedCount > 0 && !isFullySelected;
                    const isExpanded = expandedGroupIds.has(group.id);

                    return (
                      <div key={`group-${group.id}`} className="rounded-lg border border-border/80 bg-transparent">
                        <div className={`w-full p-3 rounded-lg transition-colors ${
                          isFullySelected
                            ? tone.selectedRow
                            : isPartial
                            ? tone.selectedRowSoft
                            : 'hover:bg-muted/80'
                        }`}>
                          <div className="flex w-full items-center gap-2">
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => toggleGroupExpanded(group.id)}
                              className="flex flex-1 items-center gap-2 min-w-0 text-left"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <p className="text-gray-800 font-medium truncate dark:text-gray-100">{group.name}</p>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">({selectedCount}/{total})</span>
                            </button>
                            <Checkbox
                              checked={isFullySelected ? true : (isPartial ? 'indeterminate' : false)}
                              onCheckedChange={() => handleToggleGroupFoods(groupFoods)}
                              onMouseDown={(event) => event.preventDefault()}
                              className="ml-auto shrink-0 border-muted-foreground/70"
                              aria-label={`Seleccionar todo el grupo ${group.name}`}
                            />
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-2 pb-2 space-y-1">
                            {groupFoods.map((food) => {
                              const isSelected = selectedFoodIds.has(String(food.id));
                              const foodGroups = getFoodGroupNames(food);

                              // Conflicto unificado: dieta, sensibilidades y condiciones médicas.
                              // Se omiten preferred/non-preferred porque este componente los gestiona.
                              const rawConflict = userRestrictions
                                ? getConflictInfo(food, userRestrictions)
                                : getFoodConditionInfo(food);

                              // Normaliza la salida de getFoodConditionInfo (fallback) al mismo formato
                              const conflictBadge = (() => {
                                if (!rawConflict) return null;
                                if (['preferred', 'non-preferred'].includes(rawConflict.type)) return null;

                                // Resultado de getConflictInfo (tiene .type y .reason)
                                if (rawConflict.type) {
                                  const cfg = CONFLICT_BADGE_CONFIG[rawConflict.type];
                                  if (!cfg) return null;
                                  const Icon = cfg.icon;
                                  return (
                                    <Badge variant="outline" className={`mt-2 text-[11px] whitespace-normal text-left h-auto py-1 ${cfg.className}`}>
                                      <Icon className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                                      <span className="leading-tight">{rawConflict.reason}</span>
                                    </Badge>
                                  );
                                }

                                // Fallback: resultado de getFoodConditionInfo (tiene .variant y .label)
                                const variantMap = {
                                  avoid:     { Icon: CircleAlert, className: 'border-red-500/50 text-red-300' },
                                  recommend: { Icon: CircleCheck, className: 'border-emerald-500/50 text-emerald-300' },
                                  mixed:     { Icon: CircleAlert, className: 'border-amber-500/50 text-amber-300' },
                                };
                                const v = variantMap[rawConflict.variant];
                                if (!v) return null;
                                return (
                                  <Badge variant="outline" className={`mt-2 text-[11px] whitespace-normal text-left h-auto py-1 ${v.className}`}>
                                    <v.Icon className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                                    <span className="leading-tight">{rawConflict.label}</span>
                                  </Badge>
                                );
                              })();

                              return (
                                <button
                                  key={food.id}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => handleToggleFood(food)}
                                  className={`w-full p-3 rounded-lg transition-colors text-left border ${
                                    isSelected
                                      ? tone.selectedRow
                                      : 'bg-transparent border-transparent hover:bg-muted/80'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-gray-800 font-medium truncate dark:text-gray-100">{food.name}</p>
                                      {foodGroups.length > 0 && (
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                          Grupo: {foodGroups.join(', ')}
                                        </p>
                                      )}
                                      {conflictBadge}
                                    </div>
                                    <div className={`flex items-center text-xs ${isSelected ? tone.selectedRowText : 'text-muted-foreground'}`}>
                                      {isSelected ? (
                                        <><Check className="h-4 w-4 mr-1" /> Activo</>
                                      ) : (
                                        'Agregar'
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FoodPreferenceSelector;
