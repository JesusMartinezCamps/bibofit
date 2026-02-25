import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useAuth } from '@/contexts/AuthContext';

const ManageAntioxidants = () => {
  const { user } = useAuth();
  const isCoach = user?.role === 'coach';

  const [antioxidants, setAntioxidants] = useState([]);
  const [vitamins, setVitamins] = useState([]);
  const [minerals, setMinerals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAntioxidant, setCurrentAntioxidant] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', vitamin_id: '', mineral_id: '' });
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        { data: antioxidantsData, error: antioxidantsError },
        { data: vitaminsData, error: vitaminsError },
        { data: mineralsData, error: mineralsError },
      ] = await Promise.all([
        supabase.from('antioxidants').select('*, vitamins(name), minerals(name)').order('name'),
        supabase.from('vitamins').select('id, name').order('name'),
        supabase.from('minerals').select('id, name').order('name'),
      ]);

      if (antioxidantsError) throw antioxidantsError;
      if (vitaminsError) throw vitaminsError;
      if (mineralsError) throw mineralsError;

      setAntioxidants(antioxidantsData);
      setVitamins(vitaminsData);
      setMinerals(mineralsData);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los datos.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (antioxidant = null) => {
    if (isCoach) return;
    setCurrentAntioxidant(antioxidant);
    setFormData(antioxidant ? { 
      name: antioxidant.name, 
      description: antioxidant.description || '',
      vitamin_id: antioxidant.vitamin_id || '',
      mineral_id: antioxidant.mineral_id || '',
    } : { name: '', description: '', vitamin_id: '', mineral_id: '' });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setCurrentAntioxidant(null);
    setFormData({ name: '', description: '', vitamin_id: '', mineral_id: '' });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (name, value) => {
     setFormData(prev => ({ ...prev, [name]: value, ...(name === 'vitamin_id' && { mineral_id: '' }), ...(name === 'mineral_id' && { vitamin_id: '' }) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast({ title: 'Error', description: 'El nombre es obligatorio.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    
    const payload = {
        name: formData.name,
        description: formData.description,
        vitamin_id: formData.vitamin_id ? parseInt(formData.vitamin_id) : null,
        mineral_id: formData.mineral_id ? parseInt(formData.mineral_id) : null,
    };

    try {
      if (currentAntioxidant) {
        const { error } = await supabase.from('antioxidants').update(payload).eq('id', currentAntioxidant.id);
        if (error) throw error;
        toast({ title: 'Éxito', description: 'Antioxidante actualizado.' });
      } else {
        const { error } = await supabase.from('antioxidants').insert(payload);
        if (error) throw error;
        toast({ title: 'Éxito', description: 'Antioxidante creado.' });
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (antioxidantId) => {
    try {
      await supabase.from('food_antioxidants').delete().eq('antioxidant_id', antioxidantId);
      const { error } = await supabase.from('antioxidants').delete().eq('id', antioxidantId);
      if (error) throw error;
      toast({ title: 'Éxito', description: 'Antioxidante eliminado.' });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar. Asegúrate de que no esté en uso.', variant: 'destructive' });
    }
  };
  
  const breadcrumbItems = [
    { label: 'Gestión de Contenidos', href: isCoach ? '/coach/content' : '/admin-panel/content/nutrition' },
    { label: 'Nutrición', href: isCoach ? '/coach/content' : '/admin-panel/content/nutrition' },
    { label: 'Gestionar Antioxidantes' },
  ];

  return (
    <>
      <Helmet><title>Gestionar Antioxidantes - Gsus Martz</title></Helmet>
      <main className="w-full px-4 py-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Breadcrumbs items={breadcrumbItems} />
          <Card className="mt-4 bg-[#1a1e23] border-gray-700 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestionar Antioxidantes</CardTitle>
                <CardDescription>Añade, edita o elimina tipos de antioxidantes y vincúlalos a vitaminas o minerales.</CardDescription>
              </div>
              {!isCoach && (
                <Button onClick={() => handleOpenDialog()} variant="diet"><Plus className="w-4 h-4 mr-2" />Añadir Antioxidante</Button>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>
              ) : (
                <div className="space-y-3">
                  {antioxidants.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: antioxidants.indexOf(item) * 0.05 }}
                      className="flex items-start justify-between p-4 rounded-lg bg-slate-900 border border-slate-800"
                    >
                      <div className="flex-grow">
                        <p className="font-semibold text-white">{item.name}</p>
                        <p className="text-sm text-gray-400 mt-1">{item.description}</p>
                        {(item.vitamins || item.minerals) && (
                            <div className="text-xs mt-2">
                                <span className="font-bold text-teal-400">Vinculado a:</span>{' '}
                                <span className="italic text-gray-300">{item.vitamins?.name || item.minerals?.name}</span>
                            </div>
                        )}
                      </div>
                      {!isCoach && (
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(item)} className="text-blue-400 hover:text-blue-300"><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="bg-[#1a1e23] border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>{currentAntioxidant ? 'Editar' : 'Añadir'} Antioxidante</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-gray-300">Nombre</label>
              <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-gray-300">Descripción</label>
              <Textarea id="description" name="description" value={formData.description} onChange={handleChange} />
            </div>
             <div className="space-y-2">
              <label className="text-gray-300">Vincular a Vitamina (Opcional)</label>
              <Select value={String(formData.vitamin_id || '')} onValueChange={(value) => handleSelectChange('vitamin_id', value)} disabled={!!formData.mineral_id}>
                <SelectTrigger><SelectValue placeholder="Seleccionar Vitamina..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Ninguna</SelectItem>
                  {vitamins.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
             <div className="space-y-2">
              <label className="text-gray-300">Vincular a Mineral (Opcional)</label>
              <Select value={String(formData.mineral_id || '')} onValueChange={(value) => handleSelectChange('mineral_id', value)} disabled={!!formData.vitamin_id}>
                <SelectTrigger><SelectValue placeholder="Seleccionar Mineral..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Ninguno</SelectItem>
                  {minerals.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
              <Button type="submit" variant="diet" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</> : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ManageAntioxidants;