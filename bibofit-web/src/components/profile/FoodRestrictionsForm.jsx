import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle, X, Shield, HeartPulse, Apple } from 'lucide-react';
import SearchSelectionModal from '@/components/shared/SearchSelectionModal';
import { PREFERENCE_TONES } from '@/components/profile/preferenceToneStyles';

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const FoodRestrictionsForm = ({ userId, onSaveStatusChange, onRestrictionsChange }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const sensitivityTone = PREFERENCE_TONES.orange;
  const conditionTone = PREFERENCE_TONES.red;

  const [allSensitivities, setAllSensitivities] = useState([]);
  const [allFoods, setAllFoods] = useState([]);
  const [allMedicalConditions, setAllMedicalConditions] = useState([]);
  const [selectedSensitivities, setSelectedSensitivities] = useState([]);
  const [selectedIndividualFoodRestrictions, setSelectedIndividualFoodRestrictions] = useState([]);
  const [selectedMedicalConditions, setSelectedMedicalConditions] = useState([]);

  const [isRestrictionSearchModalOpen, setIsRestrictionSearchModalOpen] = useState(false);
  const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
  const [sensitivityLevel, setSensitivityLevel] = useState('Leve');

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const [sensRes, userSensRes, foodsRes, userIndividualFoodRes, condRes, userCondRes] = await Promise.all([
          supabase.from('sensitivities').select('id, name'),
          supabase.from('user_sensitivities').select('sensitivity_id, sensitivitie_level').eq('user_id', userId),
          supabase
            .from('food')
            .select('id, name, food_to_food_groups(food_group_id, food_group:food_groups(id, name))')
            .order('name'),
          supabase
            .from('user_individual_food_restrictions')
            .select('food_id, food:food_id(id, name)')
            .eq('user_id', userId),
          supabase.from('medical_conditions').select('id, name'),
          supabase.from('user_medical_conditions').select('condition_id').eq('user_id', userId),
        ]);

        if (sensRes.data) setAllSensitivities(sensRes.data);
        if (userSensRes.data) setSelectedSensitivities(userSensRes.data);
        if (foodsRes.data) setAllFoods(foodsRes.data);
        if (userIndividualFoodRes.data) {
          setSelectedIndividualFoodRestrictions(
            userIndividualFoodRes.data.map((entry) => ({
              food_id: entry.food_id,
              food: entry.food || null,
            }))
          );
        }
        if (condRes.data) setAllMedicalConditions(condRes.data);
        if (userCondRes.data) setSelectedMedicalConditions(userCondRes.data.map((c) => c.condition_id));
      } catch (error) {
        console.error('Error fetching restrictions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  useEffect(() => {
    if (!onRestrictionsChange) return;
    onRestrictionsChange({
      sensitivityIds: selectedSensitivities.map((sensitivity) => sensitivity.sensitivity_id),
      restrictedFoodIds: selectedIndividualFoodRestrictions.map((item) => item.food_id),
      medicalConditionIds: [...selectedMedicalConditions],
    });
  }, [onRestrictionsChange, selectedSensitivities, selectedIndividualFoodRestrictions, selectedMedicalConditions]);

  const selectedSensitivityIds = useMemo(
    () => new Set(selectedSensitivities.map((s) => String(s.sensitivity_id))),
    [selectedSensitivities]
  );

  const selectedRestrictedFoodIds = useMemo(
    () => new Set(selectedIndividualFoodRestrictions.map((entry) => String(entry.food_id))),
    [selectedIndividualFoodRestrictions]
  );

  const foodById = useMemo(() => {
    const map = new Map();
    allFoods.forEach((food) => {
      map.set(String(food.id), food);
    });
    return map;
  }, [allFoods]);

  const appendRestrictedFoodsToState = (foodIds) => {
    if (!Array.isArray(foodIds) || foodIds.length === 0) return;
    setSelectedIndividualFoodRestrictions((prev) => {
      const map = new Map(prev.map((entry) => [String(entry.food_id), entry]));
      foodIds.forEach((foodId) => {
        const key = String(foodId);
        if (!map.has(key)) {
          map.set(key, {
            food_id: foodId,
            food: foodById.get(key) || null,
          });
        }
      });
      return Array.from(map.values());
    });
  };

  const handleAddSensitivity = async (sensitivity) => {
    if (!sensitivity || selectedSensitivityIds.has(String(sensitivity.id))) return false;

    if (onSaveStatusChange) onSaveStatusChange('saving');
    try {
      const { error } = await supabase.from('user_sensitivities').insert({
        user_id: userId,
        sensitivity_id: sensitivity.id,
        sensitivitie_level: sensitivityLevel,
      });
      if (error) throw error;

      setSelectedSensitivities((prev) => [
        ...prev,
        { sensitivity_id: sensitivity.id, sensitivitie_level: sensitivityLevel },
      ]);
      if (onSaveStatusChange) onSaveStatusChange('saved');
      return true;
    } catch (_e) {
      toast({ title: 'Error', description: 'No se pudo añadir la sensibilidad.', variant: 'destructive' });
      if (onSaveStatusChange) onSaveStatusChange('error');
      return false;
    }
  };

  const handleRemoveSensitivity = async (sensitivityId) => {
    if (onSaveStatusChange) onSaveStatusChange('saving');
    try {
      const { error } = await supabase
        .from('user_sensitivities')
        .delete()
        .eq('user_id', userId)
        .eq('sensitivity_id', sensitivityId);
      if (error) throw error;

      setSelectedSensitivities((prev) => prev.filter((s) => s.sensitivity_id !== sensitivityId));
      if (onSaveStatusChange) onSaveStatusChange('saved');
    } catch (_e) {
      toast({ title: 'Error', description: 'Error eliminando sensibilidad.', variant: 'destructive' });
      if (onSaveStatusChange) onSaveStatusChange('error');
    }
  };

  const handleAddCondition = async (condition) => {
    if (selectedMedicalConditions.includes(condition.id)) return;

    if (onSaveStatusChange) onSaveStatusChange('saving');
    try {
      const { error } = await supabase
        .from('user_medical_conditions')
        .insert({ user_id: userId, condition_id: condition.id });
      if (error) throw error;

      setSelectedMedicalConditions((prev) => [...prev, condition.id]);
      setIsConditionModalOpen(false);
      if (onSaveStatusChange) onSaveStatusChange('saved');
    } catch (_e) {
      toast({ title: 'Error', description: 'No se pudo añadir la condición.', variant: 'destructive' });
      if (onSaveStatusChange) onSaveStatusChange('error');
    }
  };

  const handleAddIndividualFoodRestriction = async (food) => {
    if (!food || selectedRestrictedFoodIds.has(String(food.id))) return false;

    if (onSaveStatusChange) onSaveStatusChange('saving');
    try {
      const { error } = await supabase
        .from('user_individual_food_restrictions')
        .insert({ user_id: userId, food_id: food.id });
      if (error) throw error;

      appendRestrictedFoodsToState([food.id]);
      if (onSaveStatusChange) onSaveStatusChange('saved');
      return true;
    } catch (_e) {
      toast({
        title: 'Error',
        description: 'No se pudo añadir la restricción por alimento.',
        variant: 'destructive',
      });
      if (onSaveStatusChange) onSaveStatusChange('error');
      return false;
    }
  };

  const handleAddFoodGroupRestrictions = async (groupEntry) => {
    const pendingFoodIds = (groupEntry?.pendingFoodIds || []).filter(
      (foodId) => !selectedRestrictedFoodIds.has(String(foodId))
    );
    if (pendingFoodIds.length === 0) {
      toast({
        title: 'Sin cambios',
        description: 'Todos los alimentos de este grupo ya están marcados.',
      });
      return false;
    }

    if (onSaveStatusChange) onSaveStatusChange('saving');
    try {
      const rows = pendingFoodIds.map((foodId) => ({ user_id: userId, food_id: foodId }));
      const { error } = await supabase
        .from('user_individual_food_restrictions')
        .upsert(rows, { onConflict: 'user_id,food_id' });
      if (error) throw error;

      appendRestrictedFoodsToState(pendingFoodIds);
      if (onSaveStatusChange) onSaveStatusChange('saved');
      toast({
        title: 'Grupo aplicado',
        description: `Se han marcado ${pendingFoodIds.length} alimentos del grupo "${groupEntry.name}".`,
      });
      return true;
    } catch (_e) {
      toast({
        title: 'Error',
        description: 'No se pudo aplicar la restricción por grupo.',
        variant: 'destructive',
      });
      if (onSaveStatusChange) onSaveStatusChange('error');
      return false;
    }
  };

  const handleSelectUnifiedRestriction = async (item) => {
    if (!item) return;

    let saved = false;
    if (item.itemType === 'sensitivity') {
      saved = await handleAddSensitivity({ id: item.entityId, name: item.name });
    } else if (item.itemType === 'food') {
      saved = await handleAddIndividualFoodRestriction({ id: item.entityId, name: item.name });
    } else if (item.itemType === 'group') {
      saved = await handleAddFoodGroupRestrictions(item);
    }

    if (saved) setIsRestrictionSearchModalOpen(false);
  };

  const handleRemoveIndividualFoodRestriction = async (foodId) => {
    if (!foodId) return;

    if (onSaveStatusChange) onSaveStatusChange('saving');
    try {
      const { error } = await supabase
        .from('user_individual_food_restrictions')
        .delete()
        .eq('user_id', userId)
        .eq('food_id', foodId);
      if (error) throw error;

      setSelectedIndividualFoodRestrictions((prev) =>
        prev.filter((item) => String(item.food_id) !== String(foodId))
      );
      if (onSaveStatusChange) onSaveStatusChange('saved');
    } catch (_e) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la restricción por alimento.',
        variant: 'destructive',
      });
      if (onSaveStatusChange) onSaveStatusChange('error');
    }
  };

  const handleRemoveCondition = async (conditionId) => {
    if (onSaveStatusChange) onSaveStatusChange('saving');
    try {
      const { error } = await supabase
        .from('user_medical_conditions')
        .delete()
        .eq('user_id', userId)
        .eq('condition_id', conditionId);
      if (error) throw error;

      setSelectedMedicalConditions((prev) => prev.filter((c) => c !== conditionId));
      if (onSaveStatusChange) onSaveStatusChange('saved');
    } catch (_e) {
      toast({ title: 'Error', description: 'Error eliminando condición.', variant: 'destructive' });
      if (onSaveStatusChange) onSaveStatusChange('error');
    }
  };

  const availableSensitivities = useMemo(
    () => allSensitivities.filter((s) => !selectedSensitivityIds.has(String(s.id))),
    [allSensitivities, selectedSensitivityIds]
  );

  const availableConditions = useMemo(
    () => allMedicalConditions.filter((c) => !selectedMedicalConditions.includes(c.id)),
    [allMedicalConditions, selectedMedicalConditions]
  );

  const availableFoodsForIndividualRestriction = useMemo(
    () => allFoods.filter((food) => !selectedRestrictedFoodIds.has(String(food.id))),
    [allFoods, selectedRestrictedFoodIds]
  );

  const availableFoodGroupsForRestriction = useMemo(() => {
    const groupMap = new Map();

    allFoods.forEach((food) => {
      const groups = food.food_to_food_groups || [];
      groups.forEach((entry) => {
        const groupId = entry?.food_group_id ?? entry?.food_group?.id ?? null;
        const groupName = entry?.food_group?.name || null;
        if (!groupId || !groupName) return;

        const key = String(groupId);
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            id: groupId,
            name: groupName,
            foodIds: new Set(),
            foodNames: new Set(),
          });
        }

        const target = groupMap.get(key);
        target.foodIds.add(food.id);
        target.foodNames.add(food.name);
      });
    });

    return Array.from(groupMap.values())
      .map((group) => {
        const allGroupFoodIds = Array.from(group.foodIds);
        const pendingFoodIds = allGroupFoodIds.filter(
          (foodId) => !selectedRestrictedFoodIds.has(String(foodId))
        );

        return {
          id: group.id,
          name: group.name,
          allFoodIds: allGroupFoodIds,
          pendingFoodIds,
          foodNames: Array.from(group.foodNames),
        };
      })
      .filter((group) => group.pendingFoodIds.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [allFoods, selectedRestrictedFoodIds]);

  const unifiedRestrictionItems = useMemo(() => {
    const sensitivityItems = availableSensitivities.map((item) => ({
      id: `sensitivity-${item.id}`,
      itemType: 'sensitivity',
      entityId: item.id,
      name: item.name,
      helperText: 'Sensibilidad',
      searchText: `${item.name} sensibilidad alergia intolerancia`,
    }));

    const foodItems = availableFoodsForIndividualRestriction.map((item) => ({
      id: `food-${item.id}`,
      itemType: 'food',
      entityId: item.id,
      name: item.name,
      helperText: 'Alimento específico',
      searchText: `${item.name} alimento`,
    }));

    const groupItems = availableFoodGroupsForRestriction.map((group) => ({
      id: `group-${group.id}`,
      itemType: 'group',
      entityId: group.id,
      name: group.name,
      helperText: `Grupo de alimentos (${group.pendingFoodIds.length} por marcar)`,
      pendingFoodIds: group.pendingFoodIds,
      searchText: `${group.name} grupo ${group.foodNames.join(' ')}`,
    }));

    return [...sensitivityItems, ...foodItems, ...groupItems];
  }, [availableSensitivities, availableFoodsForIndividualRestriction, availableFoodGroupsForRestriction]);

  const restrictionItemFilterFn = (item, searchTerm) => {
    const needle = normalizeText(searchTerm);
    if (!needle) return true;
    return normalizeText(item.searchText || item.name).includes(needle);
  };

  const renderRestrictionItem = (item) => {
    const typeTone =
      item.itemType === 'sensitivity'
        ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
        : item.itemType === 'food'
          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          : 'bg-sky-500/10 border-sky-500/30 text-sky-400';

    return (
      <div className="flex w-full items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.helperText}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${typeTone}`}>
          {item.itemType === 'sensitivity'
            ? 'Sensibilidad'
            : item.itemType === 'food'
              ? 'Alimento'
              : 'Grupo'}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={`p-4 rounded-lg border ${sensitivityTone.container}`}>
        <div className="flex items-center justify-between mb-4">
          <h4 className={`font-semibold flex items-center gap-2 ${sensitivityTone.title}`}>
            <Shield size={16} /> Sensibilidades
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={sensitivityTone.addButton}
            onClick={() => setIsRestrictionSearchModalOpen(true)}
          >
            <PlusCircle className="w-4 h-4 mr-2" /> Añadir
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {selectedSensitivities.length === 0 && (
            <p className="text-muted-foreground text-sm italic">¿Algo que te siente mal?</p>
          )}
          {selectedSensitivities.map((s) => {
            const details = allSensitivities.find((item) => String(item.id) === String(s.sensitivity_id));
            return details ? (
              <Badge key={s.sensitivity_id} variant="outline" className={sensitivityTone.selectedBadge}>
                {details.name} ({s.sensitivitie_level})
                <button
                  type="button"
                  onClick={() => handleRemoveSensitivity(s.sensitivity_id)}
                  className={`ml-2 ${sensitivityTone.selectedAction}`}
                >
                  <X size={14} />
                </button>
              </Badge>
            ) : null;
          })}
        </div>
      </div>

      <div className={`p-4 rounded-lg border ${conditionTone.container}`}>
        <div className="flex items-center justify-between mb-4">
          <h4 className={`font-semibold flex items-center gap-2 ${conditionTone.title}`}>
            <HeartPulse size={16} /> Condiciones Médicas
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={conditionTone.addButton}
            onClick={() => setIsConditionModalOpen(true)}
          >
            <PlusCircle className="w-4 h-4 mr-2" /> Añadir
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {selectedMedicalConditions.length === 0 && (
            <p className="text-muted-foreground text-sm italic">¿Alguna condición médica relevante?</p>
          )}
          {selectedMedicalConditions.map((conditionId) => {
            const details = allMedicalConditions.find((item) => String(item.id) === String(conditionId));
            return details ? (
              <Badge key={conditionId} variant="outline" className={conditionTone.selectedBadge}>
                {details.name}
                <button
                  type="button"
                  onClick={() => handleRemoveCondition(conditionId)}
                  className={`ml-2 ${conditionTone.selectedAction}`}
                >
                  <X size={14} />
                </button>
              </Badge>
            ) : null;
          })}
        </div>
      </div>

      <div className={`p-4 rounded-lg border ${sensitivityTone.container}`}>
        <div className="flex items-center justify-between mb-4">
          <h4 className={`font-semibold flex items-center gap-2 ${sensitivityTone.title}`}>
            <Apple size={16} /> Restricción por Alimento Específico
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={sensitivityTone.addButton}
            onClick={() => setIsRestrictionSearchModalOpen(true)}
          >
            <PlusCircle className="w-4 h-4 mr-2" /> Añadir
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {selectedIndividualFoodRestrictions.length === 0 && (
            <p className="text-muted-foreground text-sm italic">No hay alimentos individuales restringidos.</p>
          )}
          {selectedIndividualFoodRestrictions.map((entry) => {
            const details = entry.food || foodById.get(String(entry.food_id));
            return details ? (
              <Badge key={entry.food_id} variant="outline" className={sensitivityTone.selectedBadge}>
                {details.name}
                <button
                  type="button"
                  onClick={() => handleRemoveIndividualFoodRestriction(entry.food_id)}
                  className={`ml-2 ${sensitivityTone.selectedAction}`}
                >
                  <X size={14} />
                </button>
              </Badge>
            ) : null;
          })}
        </div>
      </div>

      <SearchSelectionModal
        open={isRestrictionSearchModalOpen}
        onOpenChange={setIsRestrictionSearchModalOpen}
        title="Añadir Restricción"
        searchPlaceholder="Buscar sensibilidad, alimento o grupo..."
        items={unifiedRestrictionItems}
        onSelect={handleSelectUnifiedRestriction}
        filterFn={restrictionItemFilterFn}
        renderItem={renderRestrictionItem}
        emptyText="No hay más sensibilidades, alimentos o grupos disponibles."
        headerContent={
          <div className="flex items-center gap-3 rounded bg-muted/65 border border-border p-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Nivel de sensibilidad:</span>
            <Select value={sensitivityLevel} onValueChange={setSensitivityLevel}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Leve">Leve</SelectItem>
                <SelectItem value="Moderado">Moderado</SelectItem>
                <SelectItem value="Grave">Grave</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <SearchSelectionModal
        open={isConditionModalOpen}
        onOpenChange={setIsConditionModalOpen}
        title="Añadir Condición Médica"
        searchPlaceholder="Buscar condición..."
        items={availableConditions}
        onSelect={handleAddCondition}
      />
    </div>
  );
};

export default FoodRestrictionsForm;
