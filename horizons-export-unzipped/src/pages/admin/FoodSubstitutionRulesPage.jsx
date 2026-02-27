import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2 } from 'lucide-react';

const DEFAULT_FORM = {
  source_food_id: '',
  target_food_id: '',
  confidence_score: 85,
  is_automatic: true
};

const FoodSubstitutionRulesPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [foods, setFoods] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState(DEFAULT_FORM);

  const foodsById = useMemo(() => {
    return new Map((foods || []).map(food => [food.id, food]));
  }, [foods]);

  const filteredMappings = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return mappings;

    return mappings.filter(mapping => {
      const sourceName = foodsById.get(mapping.source_food_id)?.name?.toLowerCase() || '';
      const targetName = foodsById.get(mapping.target_food_id)?.name?.toLowerCase() || '';
      return sourceName.includes(term) || targetName.includes(term);
    });
  }, [search, mappings, foodsById]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: foodsData, error: foodsError }, { data: mappingsData, error: mappingsError }] = await Promise.all([
        supabase.from('food').select('id, name').order('name'),
        supabase.from('food_substitution_mappings').select('*').order('confidence_score', { ascending: false })
      ]);

      if (foodsError) throw foodsError;
      if (mappingsError) throw mappingsError;

      setFoods(foodsData || []);
      setMappings(mappingsData || []);
    } catch (error) {
      toast({
        title: 'Error cargando normas',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.source_food_id || !formData.target_food_id) {
      toast({
        title: 'Datos incompletos',
        description: 'Debes seleccionar alimento origen y destino.',
        variant: 'destructive'
      });
      return;
    }

    if (Number(formData.source_food_id) === Number(formData.target_food_id)) {
      toast({
        title: 'Regla inválida',
        description: 'El alimento origen y destino no pueden ser iguales.',
        variant: 'destructive'
      });
      return;
    }

    const confidence = Number(formData.confidence_score);
    if (Number.isNaN(confidence) || confidence < 0 || confidence > 100) {
      toast({
        title: 'Confianza inválida',
        description: 'El nivel de confianza debe estar entre 0 y 100.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const duplicate = mappings.find(
        item =>
          Number(item.source_food_id) === Number(formData.source_food_id) &&
          Number(item.target_food_id) === Number(formData.target_food_id)
      );

      if (duplicate) {
        const { error } = await supabase
          .from('food_substitution_mappings')
          .update({
            confidence_score: confidence,
            is_automatic: formData.is_automatic
          })
          .eq('id', duplicate.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('food_substitution_mappings')
          .insert({
            source_food_id: Number(formData.source_food_id),
            target_food_id: Number(formData.target_food_id),
            confidence_score: confidence,
            is_automatic: formData.is_automatic
          });

        if (error) throw error;
      }

      toast({
        title: 'Norma guardada',
        description: 'La regla de sustitución se guardó correctamente.'
      });
      setFormData(DEFAULT_FORM);
      await fetchData();
    } catch (error) {
      toast({
        title: 'Error guardando norma',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('food_substitution_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMappings(prev => prev.filter(item => item.id !== id));
      toast({
        title: 'Norma eliminada',
        description: 'La regla fue eliminada.'
      });
    } catch (error) {
      toast({
        title: 'Error eliminando norma',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <main className="w-full px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-white">Normas de Sustitución</h1>

      <Card className="bg-[#1a1e23] border-gray-700 text-white">
        <CardHeader>
          <CardTitle>Nueva norma</CardTitle>
          <CardDescription className="text-gray-400">
            Define qué alimento sustituye a otro en caso de conflicto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <Label htmlFor="source_food_id">Alimento origen</Label>
              <select
                id="source_food_id"
                value={formData.source_food_id}
                onChange={(event) => setFormData(prev => ({ ...prev, source_food_id: event.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Selecciona...</option>
                {foods.map(food => (
                  <option key={food.id} value={food.id}>
                    {food.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="target_food_id">Alimento destino</Label>
              <select
                id="target_food_id"
                value={formData.target_food_id}
                onChange={(event) => setFormData(prev => ({ ...prev, target_food_id: event.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Selecciona...</option>
                {foods.map(food => (
                  <option key={food.id} value={food.id}>
                    {food.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="confidence_score">Confianza (0-100)</Label>
              <Input
                id="confidence_score"
                type="number"
                min={0}
                max={100}
                value={formData.confidence_score}
                onChange={(event) => setFormData(prev => ({ ...prev, confidence_score: event.target.value }))}
              />
            </div>

            <div className="flex items-end gap-3">
              <div className="flex items-center space-x-2 pb-2">
                <Switch
                  id="is_automatic"
                  checked={formData.is_automatic}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_automatic: checked }))}
                />
                <Label htmlFor="is_automatic">Automática</Label>
              </div>
              <Button type="submit" disabled={isSubmitting} className="ml-auto">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Guardar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-[#1a1e23] border-gray-700 text-white">
        <CardHeader>
          <CardTitle>Normas activas</CardTitle>
          <CardDescription className="text-gray-400">
            Reglas usadas en el mapeo automático previo a la resolución manual.
          </CardDescription>
          <Input
            placeholder="Buscar por alimento origen o destino..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-lg"
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Cargando normas...
            </div>
          ) : filteredMappings.length === 0 ? (
            <p className="text-gray-400">No hay normas para los filtros actuales.</p>
          ) : (
            <div className="space-y-2">
              {filteredMappings.map(mapping => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3"
                >
                  <div className="text-sm">
                    <p className="font-medium text-white">
                      {(foodsById.get(mapping.source_food_id)?.name || `#${mapping.source_food_id}`)}{' '}
                      <span className="text-gray-400">→</span>{' '}
                      {(foodsById.get(mapping.target_food_id)?.name || `#${mapping.target_food_id}`)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Confianza: {mapping.confidence_score ?? '-'} | Automática: {mapping.is_automatic ? 'Sí' : 'No'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(mapping.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default FoodSubstitutionRulesPage;
