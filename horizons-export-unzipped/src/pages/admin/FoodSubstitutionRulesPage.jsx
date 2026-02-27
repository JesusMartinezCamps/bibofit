import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Search, Trash2 } from 'lucide-react';

const CONFIDENCE_OPTIONS = [
  { value: 95, label: 'Alta (95%)' },
  { value: 85, label: 'Media (85%)' },
  { value: 70, label: 'Baja (70%)' }
];

const DEFAULT_FORM = {
  source_food_id: '',
  target_food_id: '',
  confidence_score: 85,
  is_automatic: true
};

const normalizeText = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeRelationType = (value = '') => {
  const relation = normalizeText(value);
  if (['to_avoid', 'evitar', 'avoid'].includes(relation)) return 'avoid';
  if (['recommended', 'recomendado', 'recommend', 'recomendar', 'to_recommend'].includes(relation)) return 'recommend';
  return relation;
};

const getSensitivityEntries = (food) =>
  (food?.food_sensitivities || [])
    .map((entry) => ({
      id: entry?.sensitivity_id ?? entry?.sensitivities?.id ?? entry?.sensitivity?.id,
      name: entry?.sensitivities?.name ?? entry?.sensitivity?.name
    }))
    .filter((item) => item.id && item.name);

const getConditionEntries = (food) =>
  (food?.food_medical_conditions || [])
    .map((entry) => ({
      id: entry?.condition_id ?? entry?.medical_conditions?.id ?? entry?.condition?.id,
      name: entry?.medical_conditions?.name ?? entry?.condition?.name,
      relation_type: normalizeRelationType(entry?.relation_type)
    }))
    .filter((item) => item.id && item.name);

const getSearchIndex = (food) => {
  const sensitivityText = getSensitivityEntries(food).map((item) => item.name).join(' ');
  const conditionText = getConditionEntries(food).map((item) => `${item.name} ${item.relation_type}`).join(' ');
  return normalizeText(`${food?.name || ''} ${sensitivityText} ${conditionText}`);
};

const matchesFoodSearch = (food, rawQuery) => {
  const index = getSearchIndex(food);
  const tokens = normalizeText(rawQuery).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  const positive = tokens.filter((token) => !token.startsWith('!'));
  const negative = tokens.filter((token) => token.startsWith('!')).map((token) => token.slice(1)).filter(Boolean);

  return positive.every((token) => index.includes(token)) && negative.every((token) => !index.includes(token));
};

const getNameMatchScore = (foodName, rawQuery) => {
  const normalizedName = normalizeText(foodName || '');
  const query = normalizeText(rawQuery || '').trim();
  const tokens = query.split(/\s+/).filter(Boolean).filter((token) => !token.startsWith('!'));

  if (!query) return 99;
  if (normalizedName === query) return 0;
  if (normalizedName.startsWith(query)) return 1;
  if (normalizedName.includes(query)) return 2;
  if (tokens.length > 0 && tokens.every((token) => normalizedName.includes(token))) return 3;
  if (tokens.length > 0 && tokens.some((token) => normalizedName.includes(token))) return 4;
  return 5;
};

const foodMatchesContext = (food, context) => {
  if (!food || !context) return false;

  if (context.type === 'sensitivity') {
    return getSensitivityEntries(food).some((item) => Number(item.id) === Number(context.sensitivity_id));
  }

  if (context.type === 'medical_condition') {
    return getConditionEntries(food).some(
      (item) =>
        Number(item.id) === Number(context.condition_id) &&
        normalizeRelationType(item.relation_type) === normalizeRelationType(context.relation_type)
    );
  }

  return false;
};

const getContextLabel = (ctx, sensitivityMap, conditionMap) => {
  if (ctx?.type === 'sensitivity') {
    return `Sensibilidad: ${sensitivityMap.get(Number(ctx.sensitivity_id)) || `#${ctx.sensitivity_id}`}`;
  }
  if (ctx?.type === 'medical_condition') {
    const relation = normalizeRelationType(ctx.relation_type);
    const prefix = relation === 'recommend' ? 'Recomendación' : 'Evitar';
    return `${prefix}: ${conditionMap.get(Number(ctx.condition_id)) || `#${ctx.condition_id}`}`;
  }
  return 'Contexto';
};

const getContextKey = (ctx) => {
  if (!ctx || typeof ctx !== 'object') return 'general';
  if (ctx.type === 'sensitivity') return `sensitivity:${ctx.sensitivity_id}`;
  if (ctx.type === 'medical_condition') return `medical_condition:${ctx.condition_id}:${normalizeRelationType(ctx.relation_type)}`;
  return 'general';
};

const getContextKeyFromMetadata = (metadata) => {
  const explicitKey = metadata?.context_key;
  if (typeof explicitKey === 'string' && explicitKey.trim()) return explicitKey;

  const contexts = Array.isArray(metadata?.conflict_contexts) ? metadata.conflict_contexts : [];
  if (contexts.length === 0) return 'general';
  return getContextKey(contexts[0]);
};

const buildContextMetadata = (context) => {
  const contextKey = context ? getContextKey(context) : 'general';
  const conflictContexts = context
    ? [
        context.type === 'sensitivity'
          ? { type: 'sensitivity', sensitivity_id: context.sensitivity_id }
          : {
              type: 'medical_condition',
              condition_id: context.condition_id,
              relation_type: context.relation_type
            }
      ]
    : [];

  return {
    context_key: contextKey,
    conflict_contexts: conflictContexts
  };
};

const buildAutomaticReason = (sourceFood, targetFood, contexts, sensitivityMap, conditionMap) => {
  if (!sourceFood?.name || !targetFood?.name) return '';

  if (!contexts || contexts.length === 0) {
    return `El alimento ${sourceFood.name} se reemplaza por: ${targetFood.name}.`;
  }

  if (contexts.length === 1) {
    const label = getContextLabel(contexts[0], sensitivityMap, conditionMap);
    return `${sourceFood.name} en conflicto con ${label}. Se reemplaza por ${targetFood.name}.`;
  }

  const labelList = contexts.map((ctx) => getContextLabel(ctx, sensitivityMap, conditionMap)).join(', ');
  return `El alimento ${sourceFood.name} en conflicto con ${labelList}. Se reemplaza por ${targetFood.name}.`;
};

const getReasonInputKeyForContext = (ctx) => (ctx ? getContextKey(ctx) : 'general');

const FoodSearchModal = ({ open, onOpenChange, foods, onSelect, selectedContexts = [], conflictVisualMode = false }) => {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];

    return foods
      .filter((food) => matchesFoodSearch(food, query))
      .sort((a, b) => {
        const scoreA = getNameMatchScore(a.name, query);
        const scoreB = getNameMatchScore(b.name, query);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return (a.name || '').localeCompare(b.name || '');
      })
      .slice(0, 50);
  }, [foods, query]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#101418] border-slate-700 text-white max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Buscar alimento</DialogTitle>
          <DialogDescription>
            Escribe el nombre o usa exclusiones como <code>!gluten</code> o <code>!diabetes</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 min-h-0 flex-1 flex flex-col">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar alimento..."
              className="pl-9"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto border border-slate-800 rounded-md">
            {results.length === 0 ? (
              <p className="text-sm text-gray-400 px-3 py-4">Escribe para ver resultados.</p>
            ) : (
              results.map((food) => {
                const isBlocked = conflictVisualMode && selectedContexts.some((ctx) => foodMatchesContext(food, ctx));
                const hasSelectedContexts = conflictVisualMode && selectedContexts.length > 0;

                let toneClass = 'bg-transparent border-slate-800';
                if (hasSelectedContexts) {
                  toneClass = isBlocked ? 'bg-red-950/20 border-red-900/50' : 'bg-green-950/15 border-green-900/30';
                }

                return (
                <button
                  key={food.id}
                  type="button"
                  disabled={isBlocked}
                  onClick={() => {
                    if (isBlocked) return;
                    onSelect(food);
                    onOpenChange(false);
                  }}
                  className={`w-full text-left px-3 py-2 border-b last:border-b-0 transition-colors ${toneClass} ${
                    isBlocked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-900'
                  }`}
                >
                  <p className="text-sm text-white">{food.name}</p>
                  <p className="text-xs text-gray-400">
                    {getSensitivityEntries(food).map((s) => s.name).join(', ') || 'Sin sensibilidades'} |{' '}
                    {getConditionEntries(food).map((c) => `${c.name} (${c.relation_type})`).join(', ') || 'Sin patologías'}
                  </p>
                  {isBlocked && <p className="text-xs text-red-300 mt-1">No seleccionable: coincide con conflicto(s) elegido(s).</p>}
                </button>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const FoodSubstitutionRulesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [foods, setFoods] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [sensitivities, setSensitivities] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [selectedContextKeys, setSelectedContextKeys] = useState([]);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [reasonByContext, setReasonByContext] = useState({});
  const [reasonTouchedByContext, setReasonTouchedByContext] = useState({});
  const [listSearch, setListSearch] = useState('');
  const [editingMappingId, setEditingMappingId] = useState(null);

  const foodsById = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);
  const sensitivityMap = useMemo(() => new Map(sensitivities.map((item) => [item.id, item.name])), [sensitivities]);
  const conditionMap = useMemo(() => new Map(conditions.map((item) => [item.id, item.name])), [conditions]);

  const selectedSourceFood = foodsById.get(Number(formData.source_food_id));
  const selectedTargetFood = foodsById.get(Number(formData.target_food_id));

  const availableContexts = useMemo(() => {
    if (!selectedSourceFood) return [];

    const sensitivityContexts = getSensitivityEntries(selectedSourceFood).map((item) => ({
      key: `sensitivity:${item.id}`,
      type: 'sensitivity',
      sensitivity_id: item.id
    }));

    const conditionContexts = getConditionEntries(selectedSourceFood)
      .filter((item) => item.relation_type === 'avoid' || item.relation_type === 'recommend')
      .map((item) => ({
        key: `medical_condition:${item.id}:${item.relation_type}`,
        type: 'medical_condition',
        condition_id: item.id,
        relation_type: item.relation_type
      }));

    return [...sensitivityContexts, ...conditionContexts];
  }, [selectedSourceFood]);

  const selectedContextObjects = useMemo(
    () => availableContexts.filter((ctx) => selectedContextKeys.includes(ctx.key)),
    [availableContexts, selectedContextKeys]
  );
  const selectedOrGeneralContexts = useMemo(
    () => (selectedContextObjects.length > 0 ? selectedContextObjects : [null]),
    [selectedContextObjects]
  );

  const destinationFoods = useMemo(() => {
    return foods.filter((food) => String(food.id) !== String(formData.source_food_id));
  }, [foods, formData.source_food_id]);

  const filteredMappings = useMemo(() => {
    const term = normalizeText(listSearch.trim());
    if (!term) return mappings;

    return mappings.filter((mapping) => {
      const sourceName = normalizeText(foodsById.get(Number(mapping.source_food_id))?.name || '');
      const targetName = normalizeText(foodsById.get(Number(mapping.target_food_id))?.name || '');
      const contextText = normalizeText(
        (mapping?.metadata?.conflict_contexts || [])
          .map((ctx) => getContextLabel(ctx, sensitivityMap, conditionMap))
          .join(' ')
      );
      return sourceName.includes(term) || targetName.includes(term) || contextText.includes(term);
    });
  }, [listSearch, mappings, foodsById, sensitivityMap, conditionMap]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [foodsRes, mappingsRes, sensitivityRes, conditionRes] = await Promise.all([
        supabase
          .from('food')
          .select(`
            id,
            name,
            food_sensitivities(sensitivity_id, sensitivities(id, name)),
            food_medical_conditions(condition_id, relation_type, medical_conditions(id, name))
          `)
          .order('name'),
        supabase.from('food_substitution_mappings').select('*').order('created_at', { ascending: false }),
        supabase.from('sensitivities').select('id, name').order('name'),
        supabase.from('medical_conditions').select('id, name').order('name')
      ]);

      if (foodsRes.error) throw foodsRes.error;
      if (mappingsRes.error) throw mappingsRes.error;
      if (sensitivityRes.error) throw sensitivityRes.error;
      if (conditionRes.error) throw conditionRes.error;

      setFoods(foodsRes.data || []);
      setMappings(mappingsRes.data || []);
      setSensitivities(sensitivityRes.data || []);
      setConditions(conditionRes.data || []);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSelectedContextKeys((prev) => prev.filter((key) => availableContexts.some((ctx) => ctx.key === key)));
  }, [availableContexts]);

  useEffect(() => {
    setReasonTouchedByContext((prevTouched) => {
      const next = {};
      selectedOrGeneralContexts.forEach((ctx) => {
        const key = getReasonInputKeyForContext(ctx);
        next[key] = Boolean(prevTouched[key]);
      });

      setReasonByContext((prevReason) => {
        const nextReason = {};
        selectedOrGeneralContexts.forEach((ctx) => {
          const key = getReasonInputKeyForContext(ctx);
          const automaticReason = buildAutomaticReason(
            selectedSourceFood,
            selectedTargetFood,
            ctx ? [ctx] : [],
            sensitivityMap,
            conditionMap
          );

          if (next[key]) {
            nextReason[key] = prevReason[key] ?? automaticReason;
          } else {
            nextReason[key] = automaticReason;
          }
        });
        return nextReason;
      });

      return next;
    });
  }, [selectedOrGeneralContexts, selectedSourceFood, selectedTargetFood, sensitivityMap, conditionMap]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.source_food_id || !formData.target_food_id) {
      toast({ title: 'Datos incompletos', description: 'Selecciona alimento origen y destino.', variant: 'destructive' });
      return;
    }

    if (Number(formData.source_food_id) === Number(formData.target_food_id)) {
      toast({ title: 'Regla inválida', description: 'Origen y destino no pueden ser iguales.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingMappingId) {
        if (selectedContextObjects.length > 1) {
          toast({
            title: 'Edición inválida',
            description: 'Edita una norma por contexto. Si necesitas varios contextos, crea nuevas normas.',
            variant: 'destructive'
          });
          return;
        }

        const editingContext = selectedContextObjects[0] || null;
        const editingKey = getReasonInputKeyForContext(editingContext);
        const payload = {
          source_food_id: Number(formData.source_food_id),
          target_food_id: Number(formData.target_food_id),
          substitution_type: 'allergen_safe',
          confidence_score: Number(formData.confidence_score),
          is_automatic: Boolean(formData.is_automatic),
          reason: (reasonByContext[editingKey] || '').trim() || null,
          metadata: buildContextMetadata(editingContext)
        };

        const { error } = await supabase
          .from('food_substitution_mappings')
          .update(payload)
          .eq('id', editingMappingId);
        if (error) throw error;
      } else {
        if (!user?.id) {
          throw new Error('No se pudo identificar al usuario creador de la norma.');
        }

        let savedCount = 0;
        for (const context of selectedOrGeneralContexts) {
          const singleContextArray = context ? [context] : [];
          const contextKey = context ? getContextKey(context) : 'general';

          const duplicate = mappings.find((mapping) => {
            if (
              Number(mapping.source_food_id) !== Number(formData.source_food_id) ||
              Number(mapping.target_food_id) !== Number(formData.target_food_id)
            ) {
              return false;
            }
            return getContextKeyFromMetadata(mapping?.metadata) === contextKey;
          });

          const automaticReason = buildAutomaticReason(
            selectedSourceFood,
            selectedTargetFood,
            singleContextArray,
            sensitivityMap,
            conditionMap
          );
          const reasonInputKey = getReasonInputKeyForContext(context);
          const useAutomaticReason = !reasonTouchedByContext[reasonInputKey];

          const payload = {
            source_food_id: Number(formData.source_food_id),
            target_food_id: Number(formData.target_food_id),
            substitution_type: 'allergen_safe',
            confidence_score: Number(formData.confidence_score),
            is_automatic: Boolean(formData.is_automatic),
            reason: (useAutomaticReason ? automaticReason : reasonByContext[reasonInputKey])?.trim() || null,
            metadata: buildContextMetadata(context)
          };

          if (duplicate) {
            const { error } = await supabase
              .from('food_substitution_mappings')
              .update(payload)
              .eq('id', duplicate.id);
            if (error) throw error;
            savedCount += 1;
          } else {
            const { error } = await supabase
              .from('food_substitution_mappings')
              .insert({ ...payload, created_by: user?.id });
            if (error) throw error;
            savedCount += 1;
          }
        }

        toast({
          title: 'Normas guardadas',
          description: `Se guardaron ${savedCount} norma(s) de sustitución.`
        });
      }
      if (editingMappingId) {
        toast({ title: 'Norma actualizada', description: 'La regla fue actualizada correctamente.' });
      }
      setFormData(DEFAULT_FORM);
      setSelectedContextKeys([]);
      setReasonByContext({});
      setReasonTouchedByContext({});
      setEditingMappingId(null);
      await fetchData();
    } catch (error) {
      toast({ title: 'Error guardando norma', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('food_substitution_mappings').delete().eq('id', id);
      if (error) throw error;
      setMappings((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Norma eliminada', description: 'La norma se eliminó.' });
    } catch (error) {
      toast({ title: 'Error eliminando norma', description: error.message, variant: 'destructive' });
    }
  };

  const handleEditMapping = (mapping) => {
    const contexts = mapping?.metadata?.conflict_contexts || [];
    const nextKeys = contexts.map((ctx) => getContextKey(ctx)).filter((value) => value !== 'general');

    setEditingMappingId(mapping.id);
    setFormData({
      source_food_id: String(mapping.source_food_id),
      target_food_id: String(mapping.target_food_id),
      confidence_score: Number(mapping.confidence_score || 85),
      is_automatic: Boolean(mapping.is_automatic)
    });
    setSelectedContextKeys(nextKeys);
    const ctx = contexts[0] || null;
    const key = getReasonInputKeyForContext(ctx);
    setReasonByContext({ [key]: mapping.reason || '' });
    setReasonTouchedByContext({ [key]: true });
  };

  return (
    <main className="w-full px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-white">Normas de Sustitución</h1>

      <Card className="bg-[#1a1e23] border-gray-700 text-white">
        <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {editingMappingId ? 'Editar norma' : 'Nueva norma'}
          </CardTitle>
          <Button
            type="submit"
            className="bg-gray-600/50"
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> 
              : <Plus className="w-4 h-4 mr-2" />
            }
            {editingMappingId ? 'Actualizar norma' : 'Guardar norma'}
          </Button>
        </div>
          <CardDescription className="text-gray-400">
            Selecciona alimento origen/destino, el conflicto aplicable y guarda la regla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Alimento origen</Label>
                <Button type="button" variant="outline" className="w-full justify-start bg-red-600/30 text-red-100 border-red-100 hover:text-red-200 hover:bg-red-500/45" 
                  onClick={() => setIsSourceModalOpen(true)}>
                  {selectedSourceFood?.name || 'Seleccionar alimento origen'}
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Alimento destino</Label>
                <Button type="button" variant="outline" className="w-full justify-start bg-emerald-400/25 hover:text-emerald-300 hover:bg-emerald-400/45" 
                  onClick={() => setIsTargetModalOpen(true)}>
                  {selectedTargetFood?.name || 'Seleccionar alimento destino'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Conflictos del alimento origen</Label>
              {availableContexts.length === 0 ? (
                <p className="text-sm text-gray-400">Selecciona un alimento origen para elegir sensibilidad/patología.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {availableContexts.map((ctx) => (
                    <label key={ctx.key} className="rounded-md border border-slate-700 px-3 py-2 text-sm bg-slate-900/70 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedContextKeys.includes(ctx.key)}
                        onChange={(event) => {
                          setSelectedContextKeys((prev) =>
                            event.target.checked ? [...prev, ctx.key] : prev.filter((key) => key !== ctx.key)
                          );
                        }}
                      />
                      {getContextLabel(ctx, sensitivityMap, conditionMap)}
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400">
                Si no seleccionas ninguno, la regla se guarda como general para ese alimento origen.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="confidence">Grado de confianza</Label>
                <select
                  id="confidence"
                  value={formData.confidence_score}
                  onChange={(event) => setFormData((prev) => ({ ...prev, confidence_score: Number(event.target.value) }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm"
                >
                  {CONFIDENCE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="is_automatic">Aplicación automática</Label>
                <div className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 flex items-center">
                  <Switch
                    id="is_automatic"
                    checked={formData.is_automatic}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_automatic: checked }))}
                  />
                  <span className="text-sm text-gray-300 ml-2">{formData.is_automatic ? 'Sí' : 'No'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Razón de la norma</Label>
              {selectedOrGeneralContexts.map((ctx) => {
                const key = getReasonInputKeyForContext(ctx);
                return (
                  <div key={key} className="rounded-md border border-slate-700 p-3 bg-slate-900/60 space-y-2">
                    <p className="text-xs text-gray-300">
                      {ctx ? getContextLabel(ctx, sensitivityMap, conditionMap) : 'Contexto general'}
                    </p>
                    <Input
                      value={reasonByContext[key] || ''}
                      onChange={(event) => {
                        setReasonByContext((prev) => ({ ...prev, [key]: event.target.value }));
                        setReasonTouchedByContext((prev) => ({ ...prev, [key]: true }));
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="px-0 text-blue-300 p-0 h-auto hover:bg-transparent hover:text-blue-200"
                      onClick={() => {
                        const automatic = buildAutomaticReason(
                          selectedSourceFood,
                          selectedTargetFood,
                          ctx ? [ctx] : [],
                          sensitivityMap,
                          conditionMap
                        );
                        setReasonByContext((prev) => ({ ...prev, [key]: automatic }));
                        setReasonTouchedByContext((prev) => ({ ...prev, [key]: false }));
                      }}
                    >
                      Restaurar texto automático
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              {editingMappingId && (
                <Button
                  type="button"
                  variant="ghost"
                  className="mr-2"
                  onClick={() => {
                    setEditingMappingId(null);
                    setFormData(DEFAULT_FORM);
                    setSelectedContextKeys([]);
                    setReasonByContext({});
                    setReasonTouchedByContext({});
                  }}
                >
                  Cancelar edición
                </Button>
              )}
              <Button type="submit" className="bg-green-600/50 hover:bg-green-600/75" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                {editingMappingId ? 'Actualizar norma' : 'Guardar norma'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-[#1a1e23] border-gray-700 text-white">
        <CardHeader>
          <CardTitle>Normas activas</CardTitle>
          <CardDescription className="text-gray-400">Listado actual de reglas de sustitución.</CardDescription>
          <Input
            value={listSearch}
            onChange={(event) => setListSearch(event.target.value)}
            placeholder="Buscar por origen, destino o conflicto..."
            className="max-w-xl"
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Cargando normas...
            </div>
          ) : filteredMappings.length === 0 ? (
            <p className="text-gray-400">No hay normas para la búsqueda actual.</p>
          ) : (
            <div className="space-y-2">
              {filteredMappings.map((mapping) => (
                <div
                  key={mapping.id}
                  onClick={() => handleEditMapping(mapping)}
                  className={`rounded-md border px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${
                    Number(editingMappingId) === Number(mapping.id)
                      ? 'border-blue-500/60 bg-blue-950/20'
                      : 'border-slate-700 bg-slate-900/70 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="text-sm">
                    <p className="font-medium text-white">
                      {(foodsById.get(Number(mapping.source_food_id))?.name || `#${mapping.source_food_id}`)} →{' '}
                      {(foodsById.get(Number(mapping.target_food_id))?.name || `#${mapping.target_food_id}`)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Confianza: {mapping.confidence_score} | Automática: {mapping.is_automatic ? 'Sí' : 'No'}
                    </p>
                    {mapping.reason && <p className="text-xs text-gray-400 mt-1">{mapping.reason}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {(mapping?.metadata?.conflict_contexts || []).length > 0
                        ? mapping.metadata.conflict_contexts.map((ctx) => getContextLabel(ctx, sensitivityMap, conditionMap)).join(' | ')
                        : 'Contexto general'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(mapping.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FoodSearchModal
        open={isSourceModalOpen}
        onOpenChange={setIsSourceModalOpen}
        foods={foods.filter((food) => String(food.id) !== String(formData.target_food_id))}
        selectedContexts={[]}
        conflictVisualMode={false}
        onSelect={(food) => {
          setFormData((prev) => ({ ...prev, source_food_id: String(food.id) }));
          setSelectedContextKeys([]);
          setReasonByContext({});
          setReasonTouchedByContext({});
        }}
      />
      <FoodSearchModal
        open={isTargetModalOpen}
        onOpenChange={setIsTargetModalOpen}
        foods={destinationFoods}
        selectedContexts={selectedContextObjects}
        conflictVisualMode={true}
        onSelect={(food) => {
          setFormData((prev) => ({ ...prev, target_food_id: String(food.id) }));
          setReasonByContext({});
          setReasonTouchedByContext({});
        }}
      />
    </main>
  );
};

export default FoodSubstitutionRulesPage;
