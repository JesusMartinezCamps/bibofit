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
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useAuth } from '@/contexts/AuthContext';

const ManageAminograms = () => {
  const { user } = useAuth();
  const isCoach = user?.role === 'coach';

  const [aminograms, setAminograms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAminogram, setCurrentAminogram] = useState(null);
  const [formData, setFormData] = useState({ name: '', funcion: '', beneficios: '', deficiencias: '' });
  const { toast } = useToast();

  const fetchAminograms = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('aminograms').select('*').order('name');
      if (error) throw error;
      setAminograms(data);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los aminogramas.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAminograms();
  }, [fetchAminograms]);

  const handleOpenDialog = (aminogram = null) => {
    if (isCoach) return; // Should not happen due to UI checks, but good for safety
    setCurrentAminogram(aminogram);
    setFormData(aminogram ? { 
      name: aminogram.name, 
      funcion: aminogram.funcion || '',
      beneficios: aminogram.beneficios || '',
      deficiencias: aminogram.deficiencias || ''
    } : { name: '', funcion: '', beneficios: '', deficiencias: '' });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setCurrentAminogram(null);
    setFormData({ name: '', funcion: '', beneficios: '', deficiencias: '' });
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
      if (currentAminogram) {
        const { error } = await supabase.from('aminograms').update(formData).eq('id', currentAminogram.id);
        if (error) throw error;
        toast({ title: 'Éxito', description: 'Aminograma actualizado.' });
      } else {
        const { error } = await supabase.from('aminograms').insert(formData);
        if (error) throw error;
        toast({ title: 'Éxito', description: 'Aminograma creado.' });
      }
      handleCloseDialog();
      fetchAminograms();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (aminogramId) => {
    try {
      const { error } = await supabase.from('aminograms').delete().eq('id', aminogramId);
      if (error) throw error;
      toast({ title: 'Éxito', description: 'Aminograma eliminado.' });
      fetchAminograms();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar. Asegúrate de que no esté en uso.', variant: 'destructive' });
    }
  };

  const breadcrumbItems = [
    { label: 'Gestión de Contenidos', href: isCoach ? '/coach/content' : '/admin-panel/content/nutrition' },
    { label: 'Nutrición', href: isCoach ? '/coach/content' : '/admin-panel/content/nutrition' },
    { label: 'Gestionar Aminogramas' },
  ];

  return (
    <>
      <Helmet><title>Gestionar Aminogramas - Gsus Martz</title></Helmet>
      <main className="w-full px-4 py-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Breadcrumbs items={breadcrumbItems} />
          <Card className="mt-4 bg-[#1a1e23] border-gray-700 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestionar Aminogramas</CardTitle>
                <CardDescription>Añade, edita o elimina aminoácidos.</CardDescription>
              </div>
              {!isCoach && (
                <Button onClick={() => handleOpenDialog()} variant="diet"><Plus className="w-4 h-4 mr-2" />Añadir Aminoácido</Button>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>
              ) : (
                <div className="space-y-3">
                  {aminograms.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: aminograms.indexOf(item) * 0.05 }}
                      className="flex items-start justify-between p-4 rounded-lg bg-slate-900 border border-slate-800"
                    >
                      <div className="flex-grow">
                        <p className="font-semibold text-white text-lg">{item.name}</p>
                        <div className="mt-2 space-y-2 text-sm">
                          <p><strong className="text-green-400">Función:</strong> <span className="text-gray-300">{item.funcion}</span></p>
                          <p><strong className="text-blue-400">Beneficios:</strong> <span className="text-gray-300">{item.beneficios}</span></p>
                          <p><strong className="text-red-400">Deficiencias:</strong> <span className="text-gray-300">{item.deficiencias}</span></p>
                        </div>
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
            <DialogTitle>{currentAminogram ? 'Editar' : 'Añadir'} Aminoácido</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-gray-300">Nombre</label>
              <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <label htmlFor="funcion" className="text-gray-300">Función</label>
              <Textarea id="funcion" name="funcion" value={formData.funcion} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <label htmlFor="beneficios" className="text-gray-300">Beneficios</label>
              <Textarea id="beneficios" name="beneficios" value={formData.beneficios} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <label htmlFor="deficiencias" className="text-gray-300">Deficiencias</label>
              <Textarea id="deficiencias" name="deficiencias" value={formData.deficiencias} onChange={handleChange} />
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

export default ManageAminograms;