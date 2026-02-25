import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Helmet } from 'react-helmet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RestrictionCard from '@/components/admin/food-restrictions/RestrictionCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const RestrictionForm = ({ item, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    recommendations: '',
    to_avoid: '',
    objective: '',
    is_ue_regulated: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        description: item.description || '',
        recommendations: item.recommendations || '',
        to_avoid: item.to_avoid || '',
        objective: item.objective || '',
        is_ue_regulated: item.is_ue_regulated || false
      });
    } else {
      setFormData({
        name: '',
        description: '',
        recommendations: '',
        to_avoid: '',
        objective: '',
        is_ue_regulated: false
      });
    }
  }, [item]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from(item?.is_ue_regulated !== undefined ? 'sensitivities' : 'medical_conditions')
        .upsert({ id: item?.id, ...formData });

      if (error) throw error;
      toast({ title: 'Éxito', description: `Restricción ${item ? 'actualizada' : 'creada'} correctamente.` });
      onSave();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const isSensitivity = item?.is_ue_regulated !== undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-300">Nombre</label>
        <Input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1" />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-300">Descripción</label>
        <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows="3" className="mt-1 textarea-field w-full" />
      </div>
       {isSensitivity && (
         <div>
            <label htmlFor="recommendations" className="block text-sm font-medium text-gray-300">Recomendaciones</label>
            <textarea name="recommendations" id="recommendations" value={formData.recommendations} onChange={handleChange} rows="3" className="mt-1 textarea-field w-full" />
         </div>
      )}
       {!isSensitivity && (
         <>
         <div>
            <label htmlFor="objective" className="block text-sm font-medium text-gray-300">Objetivo</label>
            <textarea name="objective" id="objective" value={formData.objective} onChange={handleChange} rows="2" className="mt-1 textarea-field w-full" />
        </div>
        <div>
            <label htmlFor="recommendations" className="block text-sm font-medium text-gray-300">Recomendaciones (Qué hacer)</label>
            <textarea name="recommendations" id="recommendations" value={formData.recommendations} onChange={handleChange} rows="3" className="mt-1 textarea-field w-full" />
        </div>
        </>
      )}
      <div>
        <label htmlFor="to_avoid" className="block text-sm font-medium text-gray-300">A evitar</label>
        <textarea name="to_avoid" id="to_avoid" value={formData.to_avoid} onChange={handleChange} rows="3" className="mt-1 textarea-field w-full" />
      </div>
      {isSensitivity && (
        <div className="flex items-center">
            <input type="checkbox" name="is_ue_regulated" id="is_ue_regulated" checked={formData.is_ue_regulated} onChange={handleChange} className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-green-600 focus:ring-green-500" />
            <label htmlFor="is_ue_regulated" className="ml-2 block text-sm text-gray-300">Alergeno regulado por la UE</label>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline-dark" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="diet" disabled={isSaving}>
          {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar'}
        </Button>
      </div>
    </form>
  );
};


const FoodRestrictionsPage = () => {
    const { toast } = useToast();
    const [sensitivities, setSensitivities] = useState([]);
    const [medicalConditions, setMedicalConditions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState({ sensitivities: '', conditions: '' });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: sensData, error: sensError } = await supabase.from('sensitivities').select('*, foods:food_sensitivities(food(*))').order('name');
            if (sensError) throw sensError;
            setSensitivities(sensData.map(s => ({...s, foods: s.foods.map(f => f.food).filter(Boolean)})));

            const { data: condData, error: condError } = await supabase.from('medical_conditions').select('*, foods:food_medical_conditions(relation_type, food(*))').order('name');
            if (condError) throw condError;
            
            const processedConditions = condData.map(c => {
                const foodsWithDetails = c.foods
                    .filter(f => f.food)
                    .map(f => ({
                        relation_type: f.relation_type,
                        food: f.food
                    }));
                return { ...c, foods: foodsWithDetails };
            });

            setMedicalConditions(processedConditions);

        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearchChange = (type, value) => {
      setSearchTerm(prev => ({...prev, [type]: value}));
    }
    
    const filteredSensitivities = useMemo(() => 
        sensitivities.filter(s => s.name.toLowerCase().includes(searchTerm.sensitivities.toLowerCase())),
        [sensitivities, searchTerm.sensitivities]
    );

    const filteredMedicalConditions = useMemo(() =>
        medicalConditions.filter(c => c.name.toLowerCase().includes(searchTerm.conditions.toLowerCase())),
        [medicalConditions, searchTerm.conditions]
    );

    const handleCreateNew = (type) => {
        setEditingItem(type === 'sensitivity' ? { is_ue_regulated: false } : {});
        setIsFormOpen(true);
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setIsFormOpen(true);
    };
    
    const handleDelete = async (id, type) => {
        const tableName = type === 'sensitivity' ? 'sensitivities' : 'medical_conditions';
        try {
            const { error } = await supabase.from(tableName).delete().eq('id', id);
            if(error) throw error;
            toast({title: "Éxito", description: "Restricción eliminada."});
            fetchData();
        } catch(error) {
            toast({title: "Error", description: `No se pudo eliminar: ${error.message}`, variant: "destructive"})
        }
    };

    const handleFormSave = () => {
        setIsFormOpen(false);
        setEditingItem(null);
        fetchData();
    };

    const handleUpdateFoods = useCallback((itemId, foodData, action) => {
      if (action === 'add') { // Medical condition ADD
          setMedicalConditions(prev => prev.map(mc => 
              mc.id === itemId 
                  ? { ...mc, foods: [...mc.foods, foodData] } 
                  : mc
          ));
      } else if (action === 'remove') { // Medical condition REMOVE
          setMedicalConditions(prev => prev.map(mc => 
              mc.id === itemId 
                  ? { ...mc, foods: mc.foods.filter(f => f.food.id !== foodData.food.id) }
                  : mc
          ));
      } else if (action === 'add-food') { // Sensitivity ADD
          setSensitivities(prev => prev.map(s => 
              s.id === itemId 
                  ? { ...s, foods: [...s.foods, foodData].sort((a,b) => a.name.localeCompare(b.name)) } 
                  : s
          ));
      } else if (action === 'remove-food') { // Sensitivity REMOVE
          setSensitivities(prev => prev.map(s => 
              s.id === itemId 
                  ? { ...s, foods: s.foods.filter(f => f.id !== foodData.id) } 
                  : s
          ));
      }
    }, []);


  return (
    <>
      <Helmet>
        <title>Gestión de Restricciones - Gsus Martz</title>
        <meta name="description" content="Gestiona sensibilidades y condiciones médicas." />
      </Helmet>
      <main className="w-full px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-6">Gestión de Restricciones Alimentarias</h1>
        <Tabs defaultValue="sensitivities" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800">
            <TabsTrigger value="sensitivities">Sensibilidades y Alergias</TabsTrigger>
            <TabsTrigger value="conditions">Condiciones Médicas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sensitivities" className="mt-6">
             <div className="flex justify-between items-center mb-4">
                <Input placeholder="Buscar sensibilidad..." value={searchTerm.sensitivities} onChange={(e) => handleSearchChange('sensitivities', e.target.value)} className="max-w-sm" />
                <Button onClick={() => handleCreateNew('sensitivity')}><Plus className="mr-2 h-4 w-4" /> Nueva Sensibilidad</Button>
            </div>
            {loading ? <Loader2 className="mx-auto h-8 w-8 animate-spin" /> : 
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSensitivities.map(item => <RestrictionCard key={item.id} item={item} onEdit={handleEdit} onDelete={() => handleDelete(item.id, 'sensitivity')} color="text-orange-400" type="sensitivity" onUpdateFoods={handleUpdateFoods}/>)}
                </div>
            }
          </TabsContent>
          
          <TabsContent value="conditions" className="mt-6">
            <div className="flex justify-between items-center mb-4">
                 <Input placeholder="Buscar condición..." value={searchTerm.conditions} onChange={(e) => handleSearchChange('conditions', e.target.value)} className="max-w-sm" />
                <Button onClick={() => handleCreateNew('condition')}><Plus className="mr-2 h-4 w-4" /> Nueva Condición</Button>
            </div>
            {loading ? <Loader2 className="mx-auto h-8 w-8 animate-spin" /> : 
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredMedicalConditions.map(item => <RestrictionCard key={item.id} item={item} onEdit={handleEdit} onDelete={() => handleDelete(item.id, 'condition')} color="text-red-400" type="medical_condition" onUpdateFoods={handleUpdateFoods} />)}
                </div>
            }
          </TabsContent>
        </Tabs>
      </main>

       <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>{editingItem?.id ? 'Editar' : 'Nueva'} Restricción</DialogTitle>
            <DialogDescription>
              {editingItem?.is_ue_regulated !== undefined 
                ? 'Gestiona los detalles de esta sensibilidad o alergia.'
                : 'Gestiona los detalles de esta condición médica.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <RestrictionForm item={editingItem} onSave={handleFormSave} onCancel={() => setIsFormOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FoodRestrictionsPage;