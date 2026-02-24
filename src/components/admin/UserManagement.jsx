import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { format, differenceInYears, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSearchParams } from 'react-router-dom';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, UserCog, Building2, UserPlus, X, Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const UsersManagerPage = () => {
    const { user: currentUser } = useAuth();
    const [searchParams] = useSearchParams();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [centers, setCenters] = useState([]);
    const [coachClients, setCoachClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [filterType, setFilterType] = useState('all'); // all, my_clients, unassigned, coaches
    const { toast } = useToast();

    // Dialog States
    const [isCenterDialogOpen, setIsCenterDialogOpen] = useState(false);
    const [selectedUserForCenter, setSelectedUserForCenter] = useState(null);
    
    const [isCoachDialogOpen, setIsCoachDialogOpen] = useState(false);
    const [selectedClientForCoach, setSelectedClientForCoach] = useState(null);

    const [isCenterClientsDialogOpen, setIsCenterClientsDialogOpen] = useState(false);
    const [selectedCoachForClients, setSelectedCoachForClients] = useState(null);
    const [coachCenterClients, setCoachCenterClients] = useState([]);

    // Delete User States
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const isAdmin = currentUser?.role === 'admin';

    useEffect(() => {
        const querySearch = searchParams.get('search');
        if (querySearch) {
            setSearchTerm(querySearch);
        }
    }, [searchParams]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch roles
            const { data: rolesData } = await supabase.from('roles').select('*');
            setRoles(rolesData);

            // 2. Fetch centers
            const { data: centersData } = await supabase.from('centers').select('*');
            setCenters(centersData);

            // 3. Fetch profiles
            const { data: profilesData } = await supabase.from('profiles').select('*');
            
            // 4. Fetch user roles
            const { data: userRolesData } = await supabase.from('user_roles').select('user_id, role_id, roles(id, role)');
            
            // 5. Fetch user centers
            const { data: userCentersData } = await supabase.from('user_centers').select('user_id, center_id');
            
            // 6. Fetch coach clients
            const { data: coachClientsData } = await supabase.from('coach_clients').select('id, coach_id, client_id');
            setCoachClients(coachClientsData || []);

            // Process Data
            const userRolesMap = {};
            userRolesData?.forEach(ur => userRolesMap[ur.user_id] = ur.roles);

            const userCentersMap = {};
            userCentersData?.forEach(uc => userCentersMap[uc.user_id] = uc.center_id);

            const combinedUsers = profilesData.map(profile => {
                const roleData = userRolesMap[profile.user_id] || { role: 'client', id: rolesData.find(r => r.role === 'client')?.id };
                const centerId = userCentersMap[profile.user_id];
                const center = centersData?.find(c => c.id === centerId);
                
                let age = 'N/A';
                if (profile.birth_date) {
                    const birthDate = parseISO(profile.birth_date);
                    if (isValid(birthDate)) age = differenceInYears(new Date(), birthDate);
                }

                // Get assigned coaches (if client) or clients (if coach)
                const myCoaches = (coachClientsData || [])
                    .filter(cc => cc.client_id === profile.user_id)
                    .map(cc => {
                        const coachProfile = profilesData.find(p => p.user_id === cc.coach_id);
                        return { ...coachProfile, assignment_id: cc.id };
                    });

                return {
                    ...profile,
                    role: roleData.role,
                    role_id: roleData.id,
                    center_id: centerId,
                    center_name: center?.name,
                    age,
                    registrationDate: profile.created_at ? format(parseISO(profile.created_at), 'dd/MM/yyyy', { locale: es }) : 'N/A',
                    assigned_coaches: myCoaches
                };
            });

            setUsers(combinedUsers);

        } catch (error) {
            console.error("Error fetching users:", error);
            toast({ title: "Error", description: "No se pudieron cargar los datos.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRoleChange = async (userId, newRoleId) => {
        try {
            // Check if entry exists in user_roles
            const { data: existingRole } = await supabase.from('user_roles').select('*').eq('user_id', userId).maybeSingle();

            if (existingRole) {
                const { error } = await supabase.from('user_roles').update({ role_id: parseInt(newRoleId) }).eq('user_id', userId);
                if (error) throw error;
            } else {
                 const { error } = await supabase.from('user_roles').insert({ user_id: userId, role_id: parseInt(newRoleId) });
                if (error) throw error;
            }
            
            toast({ title: "Rol actualizado", className: "bg-green-600 text-white border-none" });
            fetchData();
        } catch (error) {
            toast({ title: "Error", description: "No se pudo cambiar el rol.", variant: "destructive" });
        }
    };

    const handleCenterChange = async (userId, newCenterId) => {
        try {
            // Check if exists
            const { data: existing } = await supabase.from('user_centers').select('*').eq('user_id', userId).maybeSingle();
            
            if (newCenterId === 'none') {
                if (existing) await supabase.from('user_centers').delete().eq('user_id', userId);
            } else {
                if (existing) {
                    await supabase.from('user_centers').update({ center_id: parseInt(newCenterId) }).eq('user_id', userId);
                } else {
                    await supabase.from('user_centers').insert({ user_id: userId, center_id: parseInt(newCenterId) });
                }
            }
            
            setIsCenterDialogOpen(false);
            toast({ title: "Centro actualizado", className: "bg-green-600 text-white border-none" });
            fetchData();
        } catch (error) {
            toast({ title: "Error", description: "No se pudo cambiar el centro.", variant: "destructive" });
        }
    };

    const handleAddCoach = async (clientId, coachId) => {
        try {
            const { error } = await supabase.from('coach_clients').insert({ client_id: clientId, coach_id: coachId });
            if (error) throw error;
            
            setIsCoachDialogOpen(false);
            toast({ title: "Entrenador asignado", className: "bg-green-600 text-white border-none" });
            fetchData();
        } catch (error) {
            toast({ title: "Error", description: "No se pudo asignar el entrenador.", variant: "destructive" });
        }
    };

    const handleRemoveCoach = async (assignmentId) => {
        try {
            const { error } = await supabase.from('coach_clients').delete().eq('id', assignmentId);
            if (error) throw error;
            toast({ title: "Entrenador removido", className: "bg-green-600 text-white border-none" });
            fetchData();
        } catch (error) {
            toast({ title: "Error", description: "No se pudo remover.", variant: "destructive" });
        }
    };

    // Helper to get available coaches for a client
    const getAvailableCoaches = (client) => {
        if (!client) return [];
        
        // If not admin, strict center check is required
        if (!isAdmin && !client.center_id) return [];

        return users.filter(u => {
            // 1. Must be a coach OR be the current admin (to allow self-assignment)
            const isCoach = u.role === 'coach';
            const isMeAdmin = isAdmin && u.user_id === currentUser.id;
            
            if (!isCoach && !isMeAdmin) return false;

            // 2. Prevent duplicate assignment
            if (client.assigned_coaches.some(ac => ac.user_id === u.user_id)) return false;

            // 3. Center restrictions
            if (isAdmin) return true; // Admins can assign any coach/themselves regardless of center
            return u.center_id === client.center_id;
        });
    };

    const handleViewCenterClients = (coach) => {
        if (!coach.center_id) {
             toast({ title: "Sin centro", description: "Este entrenador no tiene un centro asignado.", variant: "warning" });
             return;
        }
        
        const clients = users.filter(u => u.role === 'client' && u.center_id === coach.center_id);
        setCoachCenterClients(clients);
        setSelectedCoachForClients(coach);
        setIsCenterClientsDialogOpen(true);
    };

    const confirmDeleteUser = (user) => {
        setUserToDelete(user);
        setIsDeleteDialogOpen(true);
    };

    const deleteUserEquivalenceAdjustments = async (userId) => {
        const { data: adjustmentIds, error: adjustmentsError } = await supabase
            .from('equivalence_adjustments')
            .select('id')
            .eq('user_id', userId);

        if (adjustmentsError) throw adjustmentsError;

        const ids = (adjustmentIds || []).map(adj => adj.id);

        if (ids.length > 0) {
            const { error: ingredientError } = await supabase
                .from('daily_ingredient_adjustments')
                .delete()
                .in('equivalence_adjustment_id', ids);
            if (ingredientError) throw ingredientError;
        }

        const { error: deleteError } = await supabase
            .from('equivalence_adjustments')
            .delete()
            .eq('user_id', userId);

        if (deleteError) throw deleteError;
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        setIsDeleting(true);

      try {
            await deleteUserEquivalenceAdjustments(userToDelete.user_id);
            // Call the database function to delete user data
            const { error } = await supabase.rpc('delete_user_complete', { p_user_id: userToDelete.user_id });

            if (error) throw error;

            toast({
                title: "Usuario eliminado",
                description: `El usuario ${userToDelete.full_name} y todos sus datos han sido eliminados.`,
                className: "bg-green-600 text-white border-none"
            });
            
            // Refresh list
            fetchData();
        } catch (error) {
            console.error("Delete user error:", error);
            toast({
                title: "Error al eliminar",
                description: "No se pudo completar la eliminación del usuario. Revisa la consola o permisos.",
                variant: "destructive"
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setUserToDelete(null);
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));
        
        if (!matchesSearch) return false;

        if (filterType === 'coaches') {
            return user.role === 'coach';
        }
        
        if (filterType === 'unassigned') {
             return user.role === 'client' && user.assigned_coaches.length === 0;
        }

        return true;
    });


    if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="w-10 h-10 animate-spin text-green-500" /></div>;

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <UserCog className="w-8 h-8 text-green-400" />
                        Gestión de Usuarios
                    </h1>
                    <p className="text-gray-400 mt-1">Administra clientes, entrenadores, centros y asignaciones.</p>
                </div>
                
                <div className="flex flex-col md:flex-row gap-3">
                     <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-[200px] bg-slate-800 border-slate-700 text-white">
                            <SelectValue placeholder="Filtrar usuarios" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-white">
                            <SelectItem value="all">Todos los usuarios</SelectItem>
                            <SelectItem value="coaches">Todos los Entrenadores</SelectItem>
                            <SelectItem value="unassigned">Sin Entrenador (Free)</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input 
                            placeholder="Buscar por nombre o email..." 
                            className="pl-9 pr-8 bg-slate-800/50 border-slate-700 text-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                         {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                                aria-label="Limpiar búsqueda"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-xl">
                <Table>
                    <TableHeader className="bg-slate-900">
                        <TableRow className="hover:bg-slate-900 border-slate-800">
                            <TableHead className="text-gray-300">Usuario</TableHead>
                            <TableHead className="text-gray-300">Rol</TableHead>
                            <TableHead className="text-gray-300">Centro</TableHead>
                            <TableHead className="text-gray-300 w-[300px]">Asignaciones / Estado</TableHead>
                            <TableHead className="text-gray-300">Edad</TableHead>
                            <TableHead className="text-gray-300 text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => (
                                <TableRow key={user.user_id} className="border-slate-800 hover:bg-slate-800/30">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-white">{user.full_name || 'Sin nombre'}</span>
                                            <span className="text-xs text-gray-500">{user.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Select 
                                            defaultValue={user.role_id?.toString()} 
                                            onValueChange={(val) => handleRoleChange(user.user_id, val)}
                                        >
                                            <SelectTrigger className="h-8 w-[130px] bg-transparent border-slate-700 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                                {roles.map(role => (
                                                    <SelectItem key={role.id} value={role.id.toString()}>
                                                        {role.role.charAt(0).toUpperCase() + role.role.slice(1)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {user.center_name ? (
                                                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                                                    <Building2 className="w-3 h-3 mr-1" />
                                                    {user.center_name}
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-gray-500 italic">Sin centro</span>
                                            )}
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 text-gray-400 hover:text-yellow-500 hover:bg-gray-600"
                                                onClick={() => {
                                                    setSelectedUserForCenter(user);
                                                    setIsCenterDialogOpen(true);
                                                }}
                                            >
                                                <UserCog className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {user.role === 'client' && (
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {user.assigned_coaches?.length > 0 ? user.assigned_coaches.map(coach => (
                                                    <Badge key={coach.assignment_id} variant="secondary" className="bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs flex items-center gap-1 pr-1">
                                                        {coach.full_name?.split(' ')[0]}
                                                        <button onClick={() => handleRemoveCoach(coach.assignment_id)} className="hover:text-red-400 ml-1">
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </Badge>
                                                )) : (
                                                    <span className="text-xs text-yellow-500/80 font-medium px-2">Free (Sin entrenador)</span>
                                                )}
                                                <Button 
                                                    variant="outline" 
                                                    size="icon" 
                                                    className="h-6 w-6 rounded-full border-dashed border-slate-600 bg-cyan-800 text-white hover:text-white hover:bg-teal-700"
                                                    onClick={() => {
                                                        setSelectedClientForCoach(user);
                                                        setIsCoachDialogOpen(true);
                                                    }}
                                                    // Admins can assign even if no center. Coaches require center match.
                                                    disabled={!isAdmin && !user.center_id}
                                                    title={(!isAdmin && !user.center_id) ? "Asigna un centro primero" : "Asignar entrenador"}
                                                >
                                                    <UserPlus className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        )}
                                        {user.role === 'coach' && (
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="text-xs text-white bg-cyan-800 h-7 border-slate-600 hover:text-white hover:bg-teal-700"
                                                onClick={() => handleViewCenterClients(user)}
                                                disabled={!user.center_id}
                                            >
                                                + Clientes
                                            </Button>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-gray-400">{user.age}</TableCell>
                                    <TableCell className="text-right">
                                        {isAdmin && user.user_id !== currentUser.id && (
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="h-8 w-8 hover:bg-red-700"
                                                onClick={() => confirmDeleteUser(user)}
                                                title="Eliminar usuario"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                        <span className="text-xs text-gray-600 block mt-1">{user.registrationDate}</span>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-gray-500">No se encontraron usuarios.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Center Assignment Dialog */}
            <Dialog open={isCenterDialogOpen} onOpenChange={setIsCenterDialogOpen}>
                <DialogContent className="bg-[#1a1e23] border-gray-700 text-white">
                    <DialogHeader>
                        <DialogTitle>Asignar Centro</DialogTitle>
                        <DialogDescription>Selecciona el centro para {selectedUserForCenter?.full_name}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Select onValueChange={(val) => handleCenterChange(selectedUserForCenter?.user_id, val)}>
                            <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                                <SelectValue placeholder="Seleccionar Centro" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                <SelectItem value="none">-- Sin Centro --</SelectItem>
                                {centers.map(c => (
                                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Coach Assignment Dialog */}
            <Dialog open={isCoachDialogOpen} onOpenChange={setIsCoachDialogOpen}>
                <DialogContent className="bg-[#1a1e23] border-gray-700 text-white">
                    <DialogHeader>
                        <DialogTitle>Asignar Entrenador</DialogTitle>
                        <DialogDescription>
                            {isAdmin 
                                ? "Como administrador, puedes asignar cualquier entrenador o asignarte a ti mismo, independientemente del centro."
                                : <>Selecciona un entrenador del centro <strong>{selectedClientForCoach?.center_name}</strong>.</>
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Select onValueChange={(val) => handleAddCoach(selectedClientForCoach?.user_id, val)}>
                            <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                                <SelectValue placeholder="Seleccionar Entrenador" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                {selectedClientForCoach && getAvailableCoaches(selectedClientForCoach).length > 0 ? (
                                    getAvailableCoaches(selectedClientForCoach).map(c => (
                                        <SelectItem key={c.user_id} value={c.user_id}>
                                            {c.full_name} {isAdmin && c.user_id === currentUser.id ? '(Yo)' : ''}
                                            {isAdmin && c.center_name ? ` - ${c.center_name}` : ''}
                                        </SelectItem>
                                    ))
                                ) : (
                                    <div className="p-2 text-sm text-gray-500 text-center">No hay entrenadores disponibles</div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </DialogContent>
            </Dialog>

             {/* Center Clients Overview Dialog (For Coaches View) */}
             <Dialog open={isCenterClientsDialogOpen} onOpenChange={setIsCenterClientsDialogOpen}>
                <DialogContent className="bg-[#1a1e23] border-gray-700 text-white sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Clientes en {selectedCoachForClients?.center_name}</DialogTitle>
                        <DialogDescription>
                            Listado de clientes registrados en este centro y su estado de asignación.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 max-h-[400px] overflow-y-auto space-y-2 pr-2">
                        {coachCenterClients.length > 0 ? (
                            coachCenterClients.map(client => (
                                <div key={client.user_id} className="flex items-center justify-between bg-slate-900/50 p-3 rounded border border-slate-800">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm text-white">{client.full_name}</span>
                                        <span className="text-xs text-gray-500">{client.email}</span>
                                    </div>
                                    <div>
                                        {client.assigned_coaches && client.assigned_coaches.length > 0 ? (
                                            <div className="flex flex-col items-end">
                                                {client.assigned_coaches.some(ac => ac.user_id === selectedCoachForClients?.user_id) ? (
                                                    <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30 text-[10px] border-green-500/30">
                                                        Asignado a mí
                                                    </Badge>
                                                ) : (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="text-[10px] text-gray-400">Asignado a:</span>
                                                        {client.assigned_coaches.map(ac => (
                                                            <Badge key={ac.assignment_id} variant="outline" className="text-[10px] border-slate-600 text-gray-300">
                                                                {ac.full_name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/30">
                                                Sin Entrenador
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                No hay clientes registrados en este centro.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* DELETE USER CONFIRMATION DIALOG */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="bg-[#1a1e23] border-red-900/50 text-white max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-500">
                            <AlertTriangle className="h-6 w-6" />
                            ¿Eliminar usuario permanentemente?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3 pt-3 text-gray-300">
                            <p>
                                Esta acción es <strong>irreversible</strong>. Estás a punto de eliminar al usuario 
                                <span className="font-bold text-white"> {userToDelete?.full_name} </span> 
                                ({userToDelete?.email}).
                            </p>
                            <div className="bg-red-950/30 p-3 rounded-md border border-red-900/30 text-sm">
                                <p className="font-semibold text-red-400 mb-1">Se eliminarán permanentemente:</p>
                                <ul className="list-disc pl-5 space-y-1 text-red-200/80">
                                    <li>La cuenta de usuario y acceso al sistema.</li>
                                    <li>Todos los planes de dieta y entrenamientos asignados.</li>
                                    <li>Historial de pesos y registros de progreso.</li>
                                    <li>Recetas privadas y comidas libres.</li>
                                    <li>Registro en el sistema de autenticación de Supabase.</li>
                                </ul>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 gap-2">
                        <AlertDialogCancel className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700 hover:text-white">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={(e) => {
                                e.preventDefault(); 
                                handleDeleteUser();
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white border-none flex items-center gap-2"
                            disabled={isDeleting}
                        >
                            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isDeleting ? 'Eliminando...' : 'Sí, eliminar usuario'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default UsersManagerPage;