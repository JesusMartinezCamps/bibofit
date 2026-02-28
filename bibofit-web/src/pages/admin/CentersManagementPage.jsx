import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Building2, MapPin, Trash2, Edit, Plus, Users, UserPlus, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

const CentersManagementPage = () => {
    const [centers, setCenters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentCenter, setCurrentCenter] = useState(null);
    const [formData, setFormData] = useState({ name: '', location: '', center_type: 'gym' });
    
    // Custom Center Types
    const [centerTypes, setCenterTypes] = useState(['gym', 'physio', 'nutrition', 'other']);
    const [isAddingType, setIsAddingType] = useState(false);
    const [newType, setNewType] = useState('');

    // Members Management
    const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);
    const [currentMembersCenter, setCurrentMembersCenter] = useState(null);
    const [centerMembers, setCenterMembers] = useState([]);
    const [availableUsers, setAvailableUsers] = useState([]);
    const [selectedUserToAdd, setSelectedUserToAdd] = useState('');

    const { toast } = useToast();

    const fetchCenters = async () => {
        setLoading(true);
        try {
            const { data: centersData, error: centersError } = await supabase
                .from('centers')
                .select('*')
                .order('created_at', { ascending: false });

            if (centersError) throw centersError;

            const { data: userCentersData, error: userCentersError } = await supabase
                .from('user_centers')
                .select('center_id, user_id');
            
            if (userCentersError) throw userCentersError;

            const centersWithCounts = centersData.map(center => {
                const members = userCentersData.filter(uc => uc.center_id === center.id);
                return { ...center, memberCount: members.length };
            });

            // Extract unique center types from data to add to the list
            const existingTypes = new Set(['gym', 'physio', 'nutrition', 'other']);
            centersData.forEach(c => {
                if (c.center_type) existingTypes.add(c.center_type);
            });
            setCenterTypes(Array.from(existingTypes));

            setCenters(centersWithCounts);
        } catch (error) {
            console.error("Error fetching centers:", error);
            toast({ title: "Error", description: "No se pudieron cargar los centros.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCenters();
    }, []);

    const handleOpenDialog = (center = null) => {
        setCurrentCenter(center);
        setFormData(center 
            ? { name: center.name, location: center.location || '', center_type: center.center_type || 'gym' } 
            : { name: '', location: '', center_type: 'gym' }
        );
        setIsAddingType(false);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setCurrentCenter(null);
        setFormData({ name: '', location: '', center_type: 'gym' });
        setIsAddingType(false);
        setNewType('');
    };

    const handleAddType = () => {
        if (newType && !centerTypes.includes(newType)) {
            setCenterTypes([...centerTypes, newType]);
            setFormData({...formData, center_type: newType});
            setIsAddingType(false);
            setNewType('');
        } else if (centerTypes.includes(newType)) {
             setFormData({...formData, center_type: newType});
             setIsAddingType(false);
             setNewType('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name) {
             toast({ title: 'Error', description: 'El nombre es obligatorio.', variant: 'destructive' });
             return;
        }
        
        setIsSubmitting(true);
        try {
            if (currentCenter) {
                const { error } = await supabase
                    .from('centers')
                    .update({
                        name: formData.name,
                        location: formData.location,
                        center_type: formData.center_type
                    })
                    .eq('id', currentCenter.id);
                if (error) throw error;
                toast({ title: 'Actualizado', description: 'Centro actualizado correctamente.' });
            } else {
                const { error } = await supabase
                    .from('centers')
                    .insert([{
                        name: formData.name,
                        location: formData.location,
                        center_type: formData.center_type
                    }]);
                if (error) throw error;
                toast({ title: 'Creado', description: 'Centro creado correctamente.' });
            }
            handleCloseDialog();
            fetchCenters();
        } catch (error) {
            console.error("Error saving center:", error);
            toast({ title: "Error", description: "Ocurrió un error al guardar.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Estás seguro de que quieres eliminar este centro?")) return;
        try {
            const { error } = await supabase.from('centers').delete().eq('id', id);
            if (error) throw error;
            toast({ title: 'Eliminado', description: 'Centro eliminado correctamente.' });
            fetchCenters();
        } catch (error) {
             toast({ title: "Error", description: "No se pudo eliminar el centro.", variant: "destructive" });
        }
    };

    const handleManageMembers = async (center) => {
        setCurrentMembersCenter(center);
        setIsMembersDialogOpen(true);
        // Fetch members
        try {
            // 1. Get IDs
            const { data: userCenters } = await supabase.from('user_centers').select('user_id').eq('center_id', center.id);
            const memberIds = userCenters.map(uc => uc.user_id);

            // 2. Get details
            const { data: profiles } = await supabase.from('profiles').select('*');
            const { data: roles } = await supabase.from('user_roles').select('user_id, roles(role)');
            
            const rolesMap = {};
            roles?.forEach(r => rolesMap[r.user_id] = r.roles.role);

            const members = profiles
                .filter(p => memberIds.includes(p.user_id))
                .map(p => ({ ...p, role: rolesMap[p.user_id] || 'client' }));
            
            setCenterMembers(members);

            // 3. Get available users (not in ANY center or move them)
            // For simplicity, list all users not in THIS center
            // AND exclude Admins
            const available = profiles
                .filter(p => !memberIds.includes(p.user_id))
                .map(p => ({ ...p, role: rolesMap[p.user_id] || 'client' }))
                .filter(p => p.role !== 'admin'); // Hide admins
            
            setAvailableUsers(available);

        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "No se pudieron cargar los miembros.", variant: "destructive" });
        }
    };

    const handleAddMember = async () => {
        if (!selectedUserToAdd) return;
        try {
            // Check if user already in a center (update vs insert)
            const { data: existing } = await supabase.from('user_centers').select('*').eq('user_id', selectedUserToAdd).maybeSingle();
            
            if (existing) {
                await supabase.from('user_centers').update({ center_id: currentMembersCenter.id }).eq('user_id', selectedUserToAdd);
            } else {
                await supabase.from('user_centers').insert({ user_id: selectedUserToAdd, center_id: currentMembersCenter.id });
            }

            toast({ title: "Miembro añadido", className: "bg-green-600 text-white border-none" });
            handleManageMembers(currentMembersCenter); // Refresh list
            fetchCenters(); // Refresh counts
            setSelectedUserToAdd('');
        } catch (error) {
            toast({ title: "Error", description: "No se pudo añadir el miembro.", variant: "destructive" });
        }
    };

    const handleRemoveMember = async (userId) => {
        try {
            await supabase.from('user_centers').delete().eq('user_id', userId);
            toast({ title: "Miembro removido", className: "bg-green-600 text-white border-none" });
            handleManageMembers(currentMembersCenter);
            fetchCenters();
        } catch (error) {
            toast({ title: "Error", description: "No se pudo remover el miembro.", variant: "destructive" });
        }
    };

    const getTypeLabel = (type) => {
        const types = { 'gym': 'Gimnasio', 'physio': 'Fisioterapia', 'nutrition': 'Nutrición', 'other': 'Otro' };
        return types[type] || type;
    };

    return (
        <>
            <Helmet>
                <title>Gestión de Centros - Admin Panel</title>
            </Helmet>
            <div className="p-6 max-w-[1600px] mx-auto space-y-6">
                 <motion.div 
                    initial={{ opacity: 0, y: -20 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Building2 className="w-8 h-8 text-green-400" />
                            Gestión de Centros
                        </h1>
                        <p className="text-gray-400 mt-1">Administra las ubicaciones, centros asociados y sus miembros.</p>
                    </div>
                    <Button onClick={() => handleOpenDialog()} className="bg-green-600 hover:bg-green-700 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Centro
                    </Button>
                </motion.div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-xl">
                    <Table>
                        <TableHeader className="bg-slate-900">
                            <TableRow className="hover:bg-slate-900 border-slate-800">
                                <TableHead className="text-gray-300 font-semibold">Nombre</TableHead>
                                <TableHead className="text-gray-300 font-semibold">Ubicación</TableHead>
                                <TableHead className="text-gray-300 font-semibold">Tipo</TableHead>
                                <TableHead className="text-gray-300 font-semibold">Miembros</TableHead>
                                <TableHead className="text-gray-300 font-semibold">Fecha Creación</TableHead>
                                <TableHead className="text-gray-300 font-semibold text-center">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center">
                                        <div className="flex justify-center items-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : centers.length > 0 ? (
                                centers.map((center) => (
                                    <TableRow key={center.id} className="border-slate-800 hover:bg-slate-800/30">
                                        <TableCell className="font-medium text-white">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-green-500">
                                                    <Building2 className="w-4 h-4" />
                                                </div>
                                                {center.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-gray-400">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-3 h-3" />
                                                {center.location || 'No especificada'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-800 text-gray-300 border border-slate-700">
                                                {getTypeLabel(center.center_type)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-gray-300">
                                                <Users className="w-4 h-4 text-blue-400" />
                                                {center.memberCount}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-gray-400">
                                            {center.created_at ? format(parseISO(center.created_at), 'dd/MM/yyyy', { locale: es }) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-center gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => handleManageMembers(center)} className="text-green-400 hover:text-green-300 hover:bg-green-900/20 mr-2">
                                                    <Users className="w-4 h-4 mr-1" />
                                                    Miembros
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(center)} className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20">
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(center.id)} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                                        No se encontraron centros registrados.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Edit Center Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
                <DialogContent className="bg-[#1a1e23] border-gray-700 text-white sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{currentCenter ? 'Editar Centro' : 'Nuevo Centro'}</DialogTitle>
                        <DialogDescription>
                            {currentCenter ? 'Modifica los detalles del centro existente.' : 'Ingresa la información para registrar un nuevo centro.'}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium text-gray-300">Nombre del Centro</label>
                            <Input 
                                id="name" 
                                value={formData.name} 
                                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                                placeholder="Ej: Gimnasio Central"
                                className="bg-slate-900 border-slate-700 text-white"
                                required
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <label htmlFor="location" className="text-sm font-medium text-gray-300">Ubicación</label>
                            <Input 
                                id="location" 
                                value={formData.location} 
                                onChange={(e) => setFormData({...formData, location: e.target.value})} 
                                placeholder="Ej: Calle Principal 123, Madrid"
                                className="bg-slate-900 border-slate-700 text-white"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label htmlFor="type" className="text-sm font-medium text-gray-300">Tipo de Centro</label>
                                {!isAddingType && (
                                    <Button 
                                        type="button"
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 w-6 p-0 text-green-400 hover:text-green-300"
                                        onClick={() => setIsAddingType(true)}
                                        title="Añadir nuevo tipo"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            
                            {isAddingType ? (
                                <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                                    <Input 
                                        value={newType}
                                        onChange={(e) => setNewType(e.target.value)}
                                        placeholder="Nuevo tipo..."
                                        className="bg-slate-900 border-slate-700 text-white h-10"
                                        autoFocus
                                    />
                                    <Button type="button" size="icon" onClick={handleAddType} className="bg-green-600 hover:bg-green-700 shrink-0">
                                        <Check className="w-4 h-4" />
                                    </Button>
                                    <Button type="button" size="icon" variant="ghost" onClick={() => setIsAddingType(false)} className="text-gray-400 hover:text-white shrink-0">
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Select 
                                    value={formData.center_type} 
                                    onValueChange={(val) => setFormData({...formData, center_type: val})}
                                >
                                    <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                                        <SelectValue placeholder="Selecciona un tipo" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                        {centerTypes.map(type => (
                                            <SelectItem key={type} value={type}>{getTypeLabel(type)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <DialogFooter className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                            <DialogClose asChild>
                                <Button type="button" variant="outline" className="mt-4 sm:mt-0 border-slate-600 text-gray-800 hover:bg-slate-800 hover:text-white">Cancelar</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white">
                                {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</> : 'Guardar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Manage Members Dialog */}
             <Dialog open={isMembersDialogOpen} onOpenChange={setIsMembersDialogOpen}>
                <DialogContent className="bg-[#1a1e23] border-gray-700 text-white sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Gestionar Miembros - {currentMembersCenter?.name}</DialogTitle> {/* Ensure this is correct */}
                        <DialogDescription>Añade o elimina entrenadores y clientes de este centro.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="flex gap-2">
                             <Select onValueChange={setSelectedUserToAdd} value={selectedUserToAdd}>
                                <SelectTrigger className="bg-slate-900 border-slate-700 text-white flex-1">
                                    <SelectValue placeholder="Seleccionar usuario para añadir..." />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700 text-white max-h-60">
                                    {availableUsers.map(u => (
                                        <SelectItem key={u.user_id} value={u.user_id}>
                                            {u.full_name} ({u.role === 'coach' ? 'Entrenador' : 'Cliente'})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button onClick={handleAddMember} disabled={!selectedUserToAdd} className="bg-green-600 hover:bg-green-700">
                                <UserPlus className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto border border-slate-700 rounded-md bg-slate-900/50 p-2">
                            {centerMembers.length > 0 ? (
                                <ul className="space-y-2">
                                    {centerMembers.map(member => (
                                        <li key={member.user_id} className="flex justify-between items-center p-2 hover:bg-slate-800 rounded">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-white">{member.full_name}</span>
                                                <div className="flex gap-2">
                                                    <Badge variant="outline" className="text-[10px] border-gray-600 text-gray-400">{member.email}</Badge>
                                                    <Badge className={`text-[10px] ${member.role === 'coach' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                        {member.role === 'coach' ? 'Entrenador' : 'Cliente'}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => handleRemoveMember(member.user_id)} 
                                                className="text-gray-500 hover:text-red-400 hover:bg-transparent"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-center text-gray-500 py-4">No hay miembros asignados.</p>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default CentersManagementPage;