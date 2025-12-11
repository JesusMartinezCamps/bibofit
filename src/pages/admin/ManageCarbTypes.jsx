import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, Save, ChevronRight, Layers, Tag, ListTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const ManageCarbTypes = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    
    // Data States
    const [carbTypes, setCarbTypes] = useState([]);
    const [classifications, setClassifications] = useState([]);
    const [subtypes, setSubtypes] = useState([]);

    // Selection States
    const [selectedType, setSelectedType] = useState(null);
    const [selectedClassification, setSelectedClassification] = useState(null);

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
    const [modalLevel, setModalLevel] = useState('type'); // 'type' | 'classification' | 'subtype'
    const [currentItem, setCurrentItem] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '' });

    // Delete Confirmation States
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: types, error: typesError } = await supabase.from('carb_types').select('*').order('name');
            if (typesError) throw typesError;
            setCarbTypes(types);

            if (selectedType) {
                const { data: classes, error: classesError } = await supabase
                    .from('carb_classification')
                    .select('*')
                    .eq('carb_type_id', selectedType.id)
                    .order('name');
                if (classesError) throw classesError;
                setClassifications(classes);
            } else {
                setClassifications([]);
            }

            if (selectedClassification) {
                const { data: subs, error: subsError } = await supabase
                    .from('carb_subtypes')
                    .select('*')
                    .eq('classification_id', selectedClassification.id)
                    .order('name');
                if (subsError) throw subsError;
                setSubtypes(subs);
            } else {
                setSubtypes([]);
            }

        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedType, selectedClassification]);

    const handleOpenModal = (level, mode, item = null) => {
        setModalLevel(level);
        setModalMode(mode);
        setCurrentItem(item);
        setFormData({
            name: item ? item.name : '',
            description: item ? item.description || '' : ''
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let table = '';
            let payload = { ...formData };

            if (modalLevel === 'type') {
                table = 'carb_types';
            } else if (modalLevel === 'classification') {
                table = 'carb_classification';
                payload.carb_type_id = selectedType.id;
            } else if (modalLevel === 'subtype') {
                table = 'carb_subtypes';
                payload.classification_id = selectedClassification.id;
            }

            let error;
            if (modalMode === 'create') {
                const { error: insertError } = await supabase.from(table).insert(payload);
                error = insertError;
            } else {
                const { error: updateError } = await supabase.from(table).update(payload).eq('id', currentItem.id);
                error = updateError;
            }

            if (error) throw error;

            toast({ title: "Éxito", description: "Operación realizada correctamente." });
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const handleDeleteClick = (level, id) => {
        setDeleteTarget({ level, id });
        setDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;

        try {
            let table = '';
            if (deleteTarget.level === 'type') table = 'carb_types';
            if (deleteTarget.level === 'classification') table = 'carb_classification';
            if (deleteTarget.level === 'subtype') table = 'carb_subtypes';

            const { error } = await supabase.from(table).delete().eq('id', deleteTarget.id);
            if (error) throw error;

            toast({ title: "Eliminado", description: "Elemento eliminado correctamente." });
            
            // Reset selections if parent is deleted
            if (deleteTarget.level === 'type' && selectedType?.id === deleteTarget.id) {
                setSelectedType(null);
                setSelectedClassification(null);
            }
            if (deleteTarget.level === 'classification' && selectedClassification?.id === deleteTarget.id) {
                setSelectedClassification(null);
            }
            
            setDeleteConfirmOpen(false);
            setDeleteTarget(null);
            fetchData();
        } catch (error) {
            toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Gestión de Tipos de Carbohidratos</h1>
                    <p className="text-gray-400">Administra la jerarquía de carbohidratos: Tipos {'>'} Clasificaciones {'>'} Subtipos</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
                {/* Column 1: Carb Types */}
                <Card className="bg-[#1a1e23] border-gray-800 flex flex-col h-full">
                    <CardHeader className="pb-3 border-b border-gray-800">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                                <Layers className="h-5 w-5 text-blue-400" /> Tipos
                            </CardTitle>
                            <Button size="sm" variant="ghost" onClick={() => handleOpenModal('type', 'create')} className="h-8 w-8 p-0">
                                <Plus className="h-5 w-5" />
                            </Button>
                        </div>
                        <CardDescription>Nivel superior (Ej: Complejos)</CardDescription>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-2">
                            {carbTypes.map(type => (
                                <div 
                                    key={type.id} 
                                    onClick={() => { setSelectedType(type); setSelectedClassification(null); }}
                                    className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedType?.id === type.id ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-800/30 border-transparent hover:bg-gray-800'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className={`font-medium ${selectedType?.id === type.id ? 'text-blue-300' : 'text-gray-200'}`}>{type.name}</h3>
                                            {type.description && <p className="text-xs text-gray-500 line-clamp-2 mt-1">{type.description}</p>}
                                        </div>
                                        {selectedType?.id === type.id && (
                                            <div className="flex gap-1">
                                                <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-yellow-400" onClick={(e) => { e.stopPropagation(); handleOpenModal('type', 'edit', type); }}>
                                                    <Save className="h-3 w-3" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-red-400" onClick={(e) => { e.stopPropagation(); handleDeleteClick('type', type.id); }}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </Card>

                {/* Column 2: Classifications */}
                <Card className={`bg-[#1a1e23] border-gray-800 flex flex-col h-full ${!selectedType ? 'opacity-50 pointer-events-none' : ''}`}>
                    <CardHeader className="pb-3 border-b border-gray-800">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                                <ListTree className="h-5 w-5 text-green-400" /> Clasificaciones
                            </CardTitle>
                            <Button size="sm" variant="ghost" onClick={() => handleOpenModal('classification', 'create')} className="h-8 w-8 p-0" disabled={!selectedType}>
                                <Plus className="h-5 w-5" />
                            </Button>
                        </div>
                        <CardDescription>
                            {selectedType ? `Para: ${selectedType.name}` : 'Selecciona un tipo'}
                        </CardDescription>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-2">
                            {classifications.length === 0 && selectedType && (
                                <p className="text-sm text-gray-500 text-center py-8">Sin clasificaciones</p>
                            )}
                            {classifications.map(classification => (
                                <div 
                                    key={classification.id} 
                                    onClick={() => setSelectedClassification(classification)}
                                    className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedClassification?.id === classification.id ? 'bg-green-900/20 border-green-500/50' : 'bg-gray-800/30 border-transparent hover:bg-gray-800'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className={`font-medium ${selectedClassification?.id === classification.id ? 'text-green-300' : 'text-gray-200'}`}>{classification.name}</h3>
                                            {classification.description && <p className="text-xs text-gray-500 line-clamp-2 mt-1">{classification.description}</p>}
                                        </div>
                                        {selectedClassification?.id === classification.id && (
                                            <div className="flex gap-1">
                                                <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-yellow-400" onClick={(e) => { e.stopPropagation(); handleOpenModal('classification', 'edit', classification); }}>
                                                    <Save className="h-3 w-3" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-red-400" onClick={(e) => { e.stopPropagation(); handleDeleteClick('classification', classification.id); }}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </Card>

                {/* Column 3: Subtypes */}
                <Card className={`bg-[#1a1e23] border-gray-800 flex flex-col h-full ${!selectedClassification ? 'opacity-50 pointer-events-none' : ''}`}>
                    <CardHeader className="pb-3 border-b border-gray-800">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                                <Tag className="h-5 w-5 text-purple-400" /> Subtipos
                            </CardTitle>
                            <Button size="sm" variant="ghost" onClick={() => handleOpenModal('subtype', 'create')} className="h-8 w-8 p-0" disabled={!selectedClassification}>
                                <Plus className="h-5 w-5" />
                            </Button>
                        </div>
                        <CardDescription>
                            {selectedClassification ? `Para: ${selectedClassification.name}` : 'Selecciona una clasificación'}
                        </CardDescription>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-2">
                             {subtypes.length === 0 && selectedClassification && (
                                <p className="text-sm text-gray-500 text-center py-8">Sin subtipos</p>
                            )}
                            {subtypes.map(subtype => (
                                <div 
                                    key={subtype.id} 
                                    className="p-3 rounded-lg bg-gray-800/30 border border-transparent hover:bg-gray-800 hover:border-gray-700 transition-all group"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-medium text-gray-200">{subtype.name}</h3>
                                            {subtype.description && <p className="text-xs text-gray-500 line-clamp-2 mt-1">{subtype.description}</p>}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-yellow-400" onClick={() => handleOpenModal('subtype', 'edit', subtype)}>
                                                <Save className="h-3 w-3" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-red-400" onClick={() => handleDeleteClick('subtype', subtype.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </Card>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="bg-[#1a1e23] border-gray-800 text-white">
                    <DialogHeader>
                        <DialogTitle>
                            {modalMode === 'create' ? 'Crear' : 'Editar'} {modalLevel === 'type' ? 'Tipo' : modalLevel === 'classification' ? 'Clasificación' : 'Subtipo'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label>Nombre</Label>
                            <Input 
                                value={formData.name} 
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                placeholder="Nombre del elemento"
                                className="bg-gray-900 border-gray-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Descripción (Opcional)</Label>
                            <Textarea 
                                value={formData.description} 
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                placeholder="Breve descripción..."
                                className="bg-gray-900 border-gray-700 resize-none h-24"
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                            <Button type="submit" className="bg-green-600 hover:bg-green-700">Guardar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent className="bg-[#1a1e23] border-gray-800 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar elemento?</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-400">
                            Esta acción no se puede deshacer. Se eliminarán todos los elementos dependientes.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex gap-3 justify-end">
                        <AlertDialogCancel className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700">Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ManageCarbTypes;