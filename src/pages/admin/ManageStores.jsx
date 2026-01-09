import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useAuth } from '@/contexts/AuthContext';

const ManageStores = () => {
  const { user } = useAuth();
  const isCoach = user?.role === 'coach';

  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStore, setCurrentStore] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const { toast } = useToast();

  const fetchStores = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('stores').select('*').order('name');
      if (error) throw error;
      setStores(data);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar las tiendas.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const handleOpenDialog = (store = null) => {
    if (isCoach) return;
    setCurrentStore(store);
    setFormData(store ? { name: store.name, description: store.description || '' } : { name: '', description: '' });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setCurrentStore(null);
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
      if (currentStore) {
        const { error } = await supabase.from('stores').update(formData).eq('id', currentStore.id);
        if (error) throw error;
        toast({ title: 'Éxito', description: 'Tienda actualizada correctamente.' });
      } else {
        const { error } = await supabase.from('stores').insert(formData);
        if (error) throw error;
        toast({ title: 'Éxito', description: 'Tienda creada correctamente.' });
      }
      handleCloseDialog();
      fetchStores();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (storeId) => {
    try {
      const { error } = await supabase.from('stores').delete().eq('id', storeId);
      if (error) throw error;
      toast({ title: 'Éxito', description: 'Tienda eliminada.' });
      fetchStores();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar la tienda. Asegúrate de que no esté en uso.', variant: 'destructive' });
    }
  };

  const breadcrumbItems = [
    { label: 'Gestión de Contenidos', href: isCoach ? '/coach/content' : '/admin-panel/content/nutrition' },
    { label: 'Nutrición', href: isCoach ? '/coach/content' : '/admin-panel/content/nutrition' },
    { label: 'Gestionar Tiendas' },
  ];

  return (
    <>
      <Helmet>
        <title>Gestionar Tiendas - Gsus Martz</title>
      </Helmet>
      <main className="w-full px-4 py-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Breadcrumbs items={breadcrumbItems} />
          <Card className="mt-4 bg-[#1a1e23] border-gray-700 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestionar Tiendas</CardTitle>
                <CardDescription>Añade, edita o elimina lugares de compra.</CardDescription>
              </div>
              {!isCoach && (
                <Button onClick={() => handleOpenDialog()} variant="diet"><Plus className="w-4 h-4 mr-2" />Añadir Tienda</Button>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>
              ) : (
                <div className="space-y-3">
                  {stores.map((store) => (
                    <motion.div
                      key={store.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: stores.indexOf(store) * 0.05 }}
                      className="flex items-center justify-between p-4 rounded-lg bg-slate-900 border border-slate-800"
                    >
                      <div>
                        <p className="font-semibold text-white">{store.name}</p>
                        <p className="text-sm text-gray-400">{store.description}</p>
                      </div>
                      {!isCoach && (
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(store)} className="text-blue-400 hover:text-blue-300"><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(store.id)} className="text-red-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
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
            <DialogTitle>{currentStore ? 'Editar Tienda' : 'Añadir Nueva Tienda'}</DialogTitle>
            <DialogDescription>
              {currentStore ? 'Modifica los detalles de la tienda.' : 'Introduce los detalles de la nueva tienda.'}
            </DialogDescription>
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

export default ManageStores;