import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2, Plus, Edit } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useAuth } from '@/contexts/AuthContext';

const ManageFatTypes = () => {
  const { user } = useAuth();
  const isCoach = user?.role === 'coach';

  const [fatTypes, setFatTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentFatType, setCurrentFatType] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const { toast } = useToast();

  const fetchFatTypes = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('fat_types').select('*').order('name');
      if (error) throw error;
      setFatTypes(data);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los tipos de grasas.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFatTypes();
  }, [fetchFatTypes]);

  const handleOpenDialog = (fatType = null) => {
    if (isCoach) return;
    setCurrentFatType(fatType);
    setFormData(fatType ? { name: fatType.name, description: fatType.description || '' } : { name: '', description: '' });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setCurrentFatType(null);
    setFormData({ name: '', description: '' });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast({ title: 'Error', description: 'El nombre es obligatorio.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      if (currentFatType) {
        const { error } = await supabase.from('fat_types').update(formData).eq('id', currentFatType.id);
        if (error) throw error;
        toast({ title: 'Éxito', description: 'Tipo de grasa actualizado.' });
      } else {
        const { error } = await supabase.from('fat_types').insert(formData);
        if (error) throw error;
        toast({ title: 'Éxito', description: 'Tipo de grasa creado.' });
      }
      handleCloseDialog();
      fetchFatTypes();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const breadcrumbItems = [
    { label: 'Gestión de Contenidos', href: isCoach ? '/coach/content' : '/admin-panel/content/nutrition' },
    { label: 'Nutrición', href: isCoach ? '/coach/content' : '/admin-panel/content/nutrition' },
    { label: 'Gestionar Tipos de Grasa' },
  ];

  return (
    <>
      <Helmet><title>Gestionar Tipos de Grasa - Gsus Martz</title></Helmet>
      <main className="w-full px-4 py-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Breadcrumbs items={breadcrumbItems} />
          <Card className="mt-4 bg-[#1a1e23] border-gray-700 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestionar Tipos de Grasa</CardTitle>
                <CardDescription>Añade o edita los tipos de grasa y sus descripciones.</CardDescription>
              </div>
              {!isCoach && (
                <Button onClick={() => handleOpenDialog()} variant="diet"><Plus className="w-4 h-4 mr-2" />Añadir Tipo de Grasa</Button>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>
              ) : (
                <div className="space-y-3">
                  {fatTypes.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: fatTypes.indexOf(item) * 0.05 }}
                      className="flex items-start justify-between p-4 rounded-lg bg-slate-900 border border-slate-800"
                    >
                      <div className="flex-grow">
                        <p className="font-semibold text-white text-lg">{item.name}</p>
                        <p className="text-sm text-gray-300 mt-1">{item.description}</p>
                      </div>
                      {!isCoach && (
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(item)} className="text-blue-400 hover:text-blue-300"><Edit className="w-4 h-4" /></Button>
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
            <DialogTitle>{currentFatType ? 'Editar' : 'Añadir'} Tipo de Grasa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-gray-300">Nombre</label>
              <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-gray-300">Descripción</label>
              <Textarea id="description" name="description" value={formData.description} onChange={handleChange} />
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

export default ManageFatTypes;