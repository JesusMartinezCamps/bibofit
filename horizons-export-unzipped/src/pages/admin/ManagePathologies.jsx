import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, PlusCircle, Edit, Trash2, Shield } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';

const ManagePathologies = () => {
  const [pathologies, setPathologies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPathology, setEditingPathology] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', medical_restrictions: '' });
  const { toast } = useToast();

  const fetchPathologies = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('pathologies').select('*').order('name');
      if (error) throw error;
      setPathologies(data);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar las patologías.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPathologies();
  }, [fetchPathologies]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOpenDialog = (pathology = null) => {
    setEditingPathology(pathology);
    if (pathology) {
      setFormData({
        name: pathology.name,
        description: pathology.description || '',
        medical_restrictions: pathology.medical_restrictions || '',
      });
    } else {
      setFormData({ name: '', description: '', medical_restrictions: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('pathologies')
        .upsert(editingPathology ? { id: editingPathology.id, ...formData } : formData);
      if (error) throw error;
      toast({ title: 'Éxito', description: `Patología ${editingPathology ? 'actualizada' : 'creada'} correctamente.` });
      setIsDialogOpen(false);
      fetchPathologies();
    } catch (error) {
      toast({ title: 'Error', description: `No se pudo guardar la patología: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta patología?')) return;
    try {
      const { error } = await supabase.from('pathologies').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Éxito', description: 'Patología eliminada.' });
      fetchPathologies();
    } catch (error) {
      toast({ title: 'Error', description: `No se pudo eliminar la patología: ${error.message}`, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 md:p-8 text-white">
      <Breadcrumbs
        items={[
          { label: 'Panel de Admin', path: '/admin-panel' },
          { label: 'Gestión de Contenido', path: '/admin-panel/content' },
          { label: 'Patologías' },
        ]}
      />
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-green-400 flex items-center gap-3">
          <Shield className="w-8 h-8" />
          Gestionar Patologías
        </h1>
        <Button onClick={() => handleOpenDialog()} className="bg-green-500 hover:bg-green-600">
          <PlusCircle className="mr-2 h-4 w-4" />
          Añadir Patología
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      ) : (
        <div className="bg-gray-900/50 rounded-lg shadow-lg border border-gray-700">
          <ul className="divide-y divide-gray-700">
            {pathologies.map((pathology) => (
              <li key={pathology.id} className="p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors">
                <div>
                  <p className="font-semibold text-lg text-white">{pathology.name}</p>
                  <p className="text-sm text-gray-400">{pathology.description}</p>
                  {pathology.medical_restrictions && <p className="text-xs text-red-400 mt-1">Restricciones: {pathology.medical_restrictions}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(pathology)} className="text-blue-400 hover:text-blue-300">
                    <Edit className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(pathology.id)} className="text-red-500 hover:text-red-400">
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#1a1e23] border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>{editingPathology ? 'Editar' : 'Crear'} Patología</DialogTitle>
            <DialogDescription>
              {editingPathology ? 'Modifica los detalles de la patología.' : 'Añade una nueva patología al sistema.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
              <Input id="name" name="name" value={formData.name} onChange={handleFormChange} required />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">Descripción</label>
              <Textarea id="description" name="description" value={formData.description} onChange={handleFormChange} />
            </div>
            <div>
              <label htmlFor="medical_restrictions" className="block text-sm font-medium text-gray-300 mb-1">Restricciones Médicas</label>
              <Textarea id="medical_restrictions" name="medical_restrictions" value={formData.medical_restrictions} onChange={handleFormChange} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-green-500 hover:bg-green-600">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Guardar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagePathologies;