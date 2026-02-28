import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, UserCog, Building2, UserPlus, X, Trash2, AlertTriangle, Users, Briefcase, UserCheck, UserX, ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react';
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

const PAGE_SIZE = 50;

const UsersManagerPage = () => {
    const { user: currentUser } = useAuth();
    const [searchParams] = useSearchParams();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [centers, setCenters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [updatingRoleByUserId, setUpdatingRoleByUserId] = useState({});
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [filterType, setFilterType] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState({ key: 'user', direction: 'asc' });
    const [expandedCenters, setExpandedCenters] = useState({});
    const { toast } = useToast();

    const [isCenterDialogOpen, setIsCenterDialogOpen] = useState(false);
    const [selectedUserForCenter, setSelectedUserForCenter] = useState(null);

    const [isCoachDialogOpen, setIsCoachDialogOpen] = useState(false);
    const [selectedClientForCoach, setSelectedClientForCoach] = useState(null);

    const [isCenterClientsDialogOpen, setIsCenterClientsDialogOpen] = useState(false);
    const [selectedCoachForClients, setSelectedCoachForClients] = useState(null);
    const [coachCenterClients, setCoachCenterClients] = useState([]);

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

    const fetchData = useCallback(async ({ showLoader = true } = {}) => {
        if (showLoader) setLoading(true);
        if (!showLoader) setIsRefreshing(true);

        try {
            const [
                rolesRes,
                centersRes,
                profilesRes,
                userRolesRes,
                userCentersRes,
                coachClientsRes,
            ] = await Promise.all([
                supabase.from('roles').select('id, role'),
                supabase.from('centers').select('id, name'),
                supabase.from('profiles').select('user_id, full_name, email, birth_date, created_at'),
                supabase.from('user_roles').select('user_id, role_id, roles(id, role)'),
                supabase.from('user_centers').select('user_id, center_id'),
                supabase.from('coach_clients').select('id, coach_id, client_id'),
            ]);

            if (rolesRes.error) throw rolesRes.error;
            if (centersRes.error) throw centersRes.error;
            if (profilesRes.error) throw profilesRes.error;
            if (userRolesRes.error) throw userRolesRes.error;
            if (userCentersRes.error) throw userCentersRes.error;
            if (coachClientsRes.error) throw coachClientsRes.error;

            const rolesData = rolesRes.data || [];
            const centersData = centersRes.data || [];
            const profilesData = profilesRes.data || [];
            const userRolesData = userRolesRes.data || [];
            const userCentersData = userCentersRes.data || [];
            const coachClientsData = coachClientsRes.data || [];

            const clientRole = rolesData.find((r) => r.role === 'client');

            const centersById = new Map(centersData.map((c) => [c.id, c]));
            const profilesById = new Map(profilesData.map((p) => [p.user_id, p]));

            const userRoleByUserId = new Map();
            userRolesData.forEach((ur) => {
                userRoleByUserId.set(ur.user_id, {
                    id: ur.roles?.id ?? ur.role_id ?? clientRole?.id,
                    role: ur.roles?.role ?? 'client',
                });
            });

            const userCenterByUserId = new Map();
            userCentersData.forEach((uc) => {
                userCenterByUserId.set(uc.user_id, uc.center_id);
            });

            const assignedCoachesByClient = new Map();
            coachClientsData.forEach((assignment) => {
                const coachProfile = profilesById.get(assignment.coach_id);
                if (!coachProfile) return;

                const currentAssignments = assignedCoachesByClient.get(assignment.client_id) || [];
                currentAssignments.push({ ...coachProfile, assignment_id: assignment.id });
                assignedCoachesByClient.set(assignment.client_id, currentAssignments);
            });

            const combinedUsers = profilesData.map((profile) => {
                const roleData = userRoleByUserId.get(profile.user_id) || { role: 'client', id: clientRole?.id };
                const centerId = userCenterByUserId.get(profile.user_id);
                const center = centerId ? centersById.get(centerId) : null;

                let age = 'N/A';
                if (profile.birth_date) {
                    const birthDate = parseISO(profile.birth_date);
                    if (isValid(birthDate)) age = differenceInYears(new Date(), birthDate);
                }

                return {
                    ...profile,
                    role: roleData.role,
                    role_id: roleData.id,
                    center_id: centerId,
                    center_name: center?.name,
                    age,
                    registrationDate: profile.created_at
                        ? format(parseISO(profile.created_at), 'dd/MM/yyyy', { locale: es })
                        : 'N/A',
                    assigned_coaches: assignedCoachesByClient.get(profile.user_id) || [],
                };
            });

            setRoles(rolesData);
            setCenters(centersData);
            setUsers(combinedUsers);
        } catch (error) {
            console.error("Error fetching users:", error);
            toast({ title: "Error", description: "No se pudieron cargar los datos.", variant: "destructive" });
        } finally {
            if (showLoader) setLoading(false);
            if (!showLoader) setIsRefreshing(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData({ showLoader: true });
    }, [fetchData]);

    const refreshData = useCallback(() => fetchData({ showLoader: false }), [fetchData]);

    const handleRoleChange = async (userId, newRoleId) => {
        const parsedRoleId = parseInt(newRoleId, 10);
        const selectedRole = roles.find((role) => role.id === parsedRoleId);
        const previousUser = users.find((u) => u.user_id === userId);
        if (!previousUser || !selectedRole) return;

        setUpdatingRoleByUserId((prev) => ({ ...prev, [userId]: true }));
        setUsers((prevUsers) =>
            prevUsers.map((u) =>
                u.user_id === userId
                    ? { ...u, role_id: parsedRoleId, role: selectedRole.role }
                    : u
            )
        );

        try {
            const { error } = await supabase
                .from('user_roles')
                .upsert(
                    { user_id: userId, role_id: parsedRoleId },
                    { onConflict: 'user_id' }
                );

            if (error) throw error;

            toast({ title: "Rol actualizado", className: "bg-green-600 text-white border-none" });
        } catch (error) {
            setUsers((prevUsers) =>
                prevUsers.map((u) =>
                    u.user_id === userId
                        ? { ...u, role_id: previousUser.role_id, role: previousUser.role }
                        : u
                )
            );
            toast({ title: "Error", description: "No se pudo cambiar el rol.", variant: "destructive" });
        } finally {
            setUpdatingRoleByUserId((prev) => ({ ...prev, [userId]: false }));
        }
    };

    const handleCenterChange = async (userId, newCenterId) => {
        try {
            const { data: existing, error: findError } = await supabase
                .from('user_centers')
                .select('user_id')
                .eq('user_id', userId)
                .maybeSingle();
            if (findError) throw findError;

            if (newCenterId === 'none') {
                if (existing) {
                    const { error } = await supabase.from('user_centers').delete().eq('user_id', userId);
                    if (error) throw error;
                }
            } else {
                const centerId = parseInt(newCenterId, 10);
                if (existing) {
                    const { error } = await supabase
                        .from('user_centers')
                        .update({ center_id: centerId })
                        .eq('user_id', userId);
                    if (error) throw error;
                } else {
                    const { error } = await supabase
                        .from('user_centers')
                        .insert({ user_id: userId, center_id: centerId });
                    if (error) throw error;
                }
            }

            setIsCenterDialogOpen(false);
            toast({ title: "Centro actualizado", className: "bg-green-600 text-white border-none" });
            refreshData();
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
            refreshData();
        } catch (error) {
            toast({ title: "Error", description: "No se pudo asignar el entrenador.", variant: "destructive" });
        }
    };

    const handleRemoveCoach = async (assignmentId) => {
        try {
            const { error } = await supabase.from('coach_clients').delete().eq('id', assignmentId);
            if (error) throw error;
            toast({ title: "Entrenador removido", className: "bg-green-600 text-white border-none" });
            refreshData();
        } catch (error) {
            toast({ title: "Error", description: "No se pudo remover.", variant: "destructive" });
        }
    };

    const getAvailableCoaches = (client) => {
        if (!client) return [];
        if (!isAdmin && !client.center_id) return [];

        return users.filter((u) => {
            const isCoach = u.role === 'coach';
            const isMeAdmin = isAdmin && u.user_id === currentUser.id;

            if (!isCoach && !isMeAdmin) return false;
            if (client.assigned_coaches.some((ac) => ac.user_id === u.user_id)) return false;

            if (isAdmin) return true;
            return u.center_id === client.center_id;
        });
    };

    const handleViewCenterClients = (coach) => {
        if (!coach.center_id) {
            toast({ title: "Sin centro", description: "Este entrenador no tiene un centro asignado.", variant: "warning" });
            return;
        }

        const clients = users.filter((u) => u.role === 'client' && u.center_id === coach.center_id);
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

        const ids = (adjustmentIds || []).map((adj) => adj.id);

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
            const { error } = await supabase.rpc('delete_user_complete', { p_user_id: userToDelete.user_id });
            if (error) throw error;

            toast({
                title: "Usuario eliminado",
                description: `El usuario ${userToDelete.full_name} y todos sus datos han sido eliminados.`,
                className: "bg-green-600 text-white border-none"
            });

            refreshData();
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

    const filteredUsers = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        return users.filter((user) => {
            const ageSearchValue = typeof user.age === 'number' ? user.age.toString() : '';
            const matchesSearch = !normalizedSearch
                || (user.full_name && user.full_name.toLowerCase().includes(normalizedSearch))
                || (user.email && user.email.toLowerCase().includes(normalizedSearch))
                || (user.center_name && user.center_name.toLowerCase().includes(normalizedSearch))
                || (user.role && user.role.toLowerCase().includes(normalizedSearch))
                || ageSearchValue.includes(normalizedSearch);

            if (!matchesSearch) return false;
            if (filterType === 'centers') return true;
            if (filterType === 'clients') return user.role === 'client';
            if (filterType === 'coaches') return user.role === 'coach';
            if (filterType === 'unassigned') return user.role === 'client' && user.assigned_coaches.length === 0;
            return true;
        });
    }, [users, searchTerm, filterType]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType]);

    const sortedUsers = useMemo(() => {
        const getSortableValue = (user) => {
            switch (sortConfig.key) {
                case 'user':
                    return (user.full_name || '').toLowerCase();
                case 'role':
                    return (user.role || '').toLowerCase();
                case 'center':
                    return (user.center_name || '').toLowerCase();
                case 'assignment':
                    if (user.role === 'client') {
                        return user.assigned_coaches.length === 0
                            ? 'free'
                            : user.assigned_coaches.map((c) => c.full_name || '').join(' ').toLowerCase();
                    }
                    return user.role === 'coach' ? 'coach' : '';
                case 'age':
                    return typeof user.age === 'number' ? user.age : null;
                case 'createdAt':
                    return user.created_at ? new Date(user.created_at).getTime() : null;
                default:
                    return '';
            }
        };

        const sorted = [...filteredUsers].sort((a, b) => {
            const valueA = getSortableValue(a);
            const valueB = getSortableValue(b);

            if (sortConfig.key === 'age' || sortConfig.key === 'createdAt') {
                if (valueA === null && valueB === null) return 0;
                if (valueA === null) return 1;
                if (valueB === null) return -1;
                return valueA - valueB;
            }

            return String(valueA).localeCompare(String(valueB), 'es', { sensitivity: 'base' });
        });

        return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
    }, [filteredUsers, sortConfig]);

    const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const paginatedUsers = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return sortedUsers.slice(start, start + PAGE_SIZE);
    }, [sortedUsers, currentPage]);

    const groupedUsersByCenter = useMemo(() => {
        const grouped = new Map();

        sortedUsers.forEach((user) => {
            const groupName = user.center_name || 'Sin centro';
            const existing = grouped.get(groupName) || [];
            existing.push(user);
            grouped.set(groupName, existing);
        });

        return [...grouped.entries()].sort(([a], [b]) => {
            if (a === 'Sin centro') return 1;
            if (b === 'Sin centro') return -1;
            return a.localeCompare(b, 'es', { sensitivity: 'base' });
        });
    }, [sortedUsers]);

    const displayedUsers = filterType === 'centers' ? sortedUsers : paginatedUsers;

    const toggleCenterGroup = (centerName) => {
        setExpandedCenters((prev) => ({
            ...prev,
            [centerName]: prev[centerName] === false ? true : false,
        }));
    };

    const handleSort = (key) => {
        setSortConfig((prev) => {
            if (prev.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const appStats = useMemo(() => {
        const coachCount = users.filter((u) => u.role === 'coach').length;
        const clientCount = users.filter((u) => u.role === 'client').length;
        const unassignedCount = users.filter((u) => u.role === 'client' && u.assigned_coaches.length === 0).length;

        return {
            total: users.length,
            coaches: coachCount,
            clients: clientCount,
            unassigned: unassignedCount,
        };
    }, [users]);

    const viewStats = useMemo(() => {
        const coachCount = filteredUsers.filter((u) => u.role === 'coach').length;
        const clientCount = filteredUsers.filter((u) => u.role === 'client').length;
        const unassignedCount = filteredUsers.filter((u) => u.role === 'client' && u.assigned_coaches.length === 0).length;

        return {
            total: filteredUsers.length,
            coaches: coachCount,
            clients: clientCount,
            unassigned: unassignedCount,
        };
    }, [filteredUsers]);

    const isViewScoped = searchTerm.trim().length > 0 || filterType !== 'all';

    const renderUserRow = (user) => (
        <TableRow key={user.user_id} className="border-slate-800 hover:bg-slate-800/30">
            <TableCell>
                <div className="flex flex-col">
                    <span className="font-medium text-white">{user.full_name || 'Sin nombre'}</span>
                    <span className="text-xs text-gray-500">{user.email}</span>
                </div>
            </TableCell>
            <TableCell>
                <Select
                    value={user.role_id?.toString()}
                    onValueChange={(val) => handleRoleChange(user.user_id, val)}
                    disabled={updatingRoleByUserId[user.user_id] || user.user_id === currentUser?.id}
                >
                    <SelectTrigger className="h-8 w-[130px] bg-transparent border-slate-700 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        {roles.map((role) => (
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
                        {user.assigned_coaches?.length > 0 ? user.assigned_coaches.map((coach) => (
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
            <TableCell className="text-gray-400 whitespace-nowrap">{user.registrationDate}</TableCell>
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
            </TableCell>
        </TableRow>
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[50vh]">
                <Loader2 className="w-10 h-10 animate-spin text-green-500" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1700px] mx-auto space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <UserCog className="w-8 h-8 text-green-400" />
                            Gestión de Usuarios
                        </h1>
                        <p className="text-gray-400 mt-1">Administra clientes, entrenadores, centros y asignaciones.</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 bg-slate-900/60 border border-slate-700 px-3 py-2 rounded-lg">
                        {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /> : null}
                        {isRefreshing ? 'Sincronizando cambios...' : 'Datos sincronizados'}
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">{isViewScoped ? 'Usuarios (vista)' : 'Total usuarios (app)'}</span>
                            <Users className="w-4 h-4 text-cyan-400" />
                        </div>
                        <p className="text-2xl font-semibold text-white mt-2">{isViewScoped ? viewStats.total : appStats.total}</p>
                        {isViewScoped && <p className="text-[11px] text-gray-500 mt-1">Total app: {appStats.total}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">{isViewScoped ? 'Entrenadores (vista)' : 'Entrenadores (app)'}</span>
                            <Briefcase className="w-4 h-4 text-green-400" />
                        </div>
                        <p className="text-2xl font-semibold text-white mt-2">{isViewScoped ? viewStats.coaches : appStats.coaches}</p>
                        {isViewScoped && <p className="text-[11px] text-gray-500 mt-1">Total app: {appStats.coaches}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">{isViewScoped ? 'Clientes (vista)' : 'Clientes (app)'}</span>
                            <UserCheck className="w-4 h-4 text-blue-400" />
                        </div>
                        <p className="text-2xl font-semibold text-white mt-2">{isViewScoped ? viewStats.clients : appStats.clients}</p>
                        {isViewScoped && <p className="text-[11px] text-gray-500 mt-1">Total app: {appStats.clients}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">{isViewScoped ? 'Clientes sin coach (vista)' : 'Clientes sin coach (app)'}</span>
                            <UserX className="w-4 h-4 text-yellow-400" />
                        </div>
                        <p className="text-2xl font-semibold text-white mt-2">{isViewScoped ? viewStats.unassigned : appStats.unassigned}</p>
                        {isViewScoped && <p className="text-[11px] text-gray-500 mt-1">Total app: {appStats.unassigned}</p>}
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex flex-col md:flex-row gap-3">
                        <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger className="w-full md:w-[220px] bg-slate-800 border-slate-700 text-white">
                                <SelectValue placeholder="Filtrar usuarios" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="clients">Clientes</SelectItem>
                                <SelectItem value="coaches">Entrenadores</SelectItem>
                                <SelectItem value="centers">Centros</SelectItem>
                                <SelectItem value="unassigned">Sin Entrenador (Free)</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="relative w-full md:w-80">
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

                    <div className="text-xs text-gray-400">
                        Mostrando {displayedUsers.length} de {sortedUsers.length} resultados
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-900">
                            <TableRow className="hover:bg-slate-900 border-slate-800">
                                <TableHead className="text-gray-300">
                                    <button type="button" onClick={() => handleSort('user')} className="inline-flex items-center gap-1 hover:text-white">
                                        Usuario
                                        <ArrowUpDown className="w-3.5 h-3.5" />
                                    </button>
                                </TableHead>
                                <TableHead className="text-gray-300">
                                    <button type="button" onClick={() => handleSort('role')} className="inline-flex items-center gap-1 hover:text-white">
                                        Rol
                                        <ArrowUpDown className="w-3.5 h-3.5" />
                                    </button>
                                </TableHead>
                                <TableHead className="text-gray-300">
                                    <button type="button" onClick={() => handleSort('center')} className="inline-flex items-center gap-1 hover:text-white">
                                        Centro
                                        <ArrowUpDown className="w-3.5 h-3.5" />
                                    </button>
                                </TableHead>
                                <TableHead className="text-gray-300 w-[300px]">
                                    <button type="button" onClick={() => handleSort('assignment')} className="inline-flex items-center gap-1 hover:text-white">
                                        Asignaciones / Estado
                                        <ArrowUpDown className="w-3.5 h-3.5" />
                                    </button>
                                </TableHead>
                                <TableHead className="text-gray-300">
                                    <button type="button" onClick={() => handleSort('age')} className="inline-flex items-center gap-1 hover:text-white">
                                        Edad
                                        <ArrowUpDown className="w-3.5 h-3.5" />
                                    </button>
                                </TableHead>
                                <TableHead className="text-gray-300">
                                    <button type="button" onClick={() => handleSort('createdAt')} className="inline-flex items-center gap-1 hover:text-white">
                                        Alta
                                        <ArrowUpDown className="w-3.5 h-3.5" />
                                    </button>
                                </TableHead>
                                <TableHead className="text-gray-300 text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayedUsers.length > 0 ? (
                                filterType === 'centers' ? (
                                    groupedUsersByCenter.map(([centerName, groupUsers]) => (
                                        <React.Fragment key={centerName}>
                                            <TableRow className="border-slate-700 bg-slate-800/70 hover:bg-slate-800/70">
                                                <TableCell colSpan={7} className="py-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCenterGroup(centerName)}
                                                        className="w-full flex items-center justify-between gap-2 text-left"
                                                    >
                                                        <span className="font-semibold text-cyan-300 inline-flex items-center gap-2">
                                                            {expandedCenters[centerName] === false ? (
                                                                <ChevronRight className="w-4 h-4 text-cyan-300" />
                                                            ) : (
                                                                <ChevronDown className="w-4 h-4 text-cyan-300" />
                                                            )}
                                                            {centerName}
                                                        </span>
                                                        <Badge variant="outline" className="border-cyan-700/60 text-cyan-300 bg-cyan-900/20">
                                                            {groupUsers.length} usuario{groupUsers.length === 1 ? '' : 's'}
                                                        </Badge>
                                                    </button>
                                                </TableCell>
                                            </TableRow>
                                            {expandedCenters[centerName] === false ? null : groupUsers.map((user) => renderUserRow(user))}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    displayedUsers.map((user) => renderUserRow(user))
                                )
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-gray-500">No se encontraron usuarios.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {filterType !== 'centers' && (
                <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">
                        Página {currentPage} de {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            className="border-slate-700 text-gray-200 hover:bg-slate-800"
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            className="border-slate-700 text-gray-200 hover:bg-slate-800"
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        >
                            Siguiente
                        </Button>
                    </div>
                </div>
            )}

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
                                {centers.map((c) => (
                                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </DialogContent>
            </Dialog>

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
                                    getAvailableCoaches(selectedClientForCoach).map((c) => (
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
                            coachCenterClients.map((client) => (
                                <div key={client.user_id} className="flex items-center justify-between bg-slate-900/50 p-3 rounded border border-slate-800">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm text-white">{client.full_name}</span>
                                        <span className="text-xs text-gray-500">{client.email}</span>
                                    </div>
                                    <div>
                                        {client.assigned_coaches && client.assigned_coaches.length > 0 ? (
                                            <div className="flex flex-col items-end">
                                                {client.assigned_coaches.some((ac) => ac.user_id === selectedCoachForClients?.user_id) ? (
                                                    <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30 text-[10px] border-green-500/30">
                                                        Asignado a mí
                                                    </Badge>
                                                ) : (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="text-[10px] text-gray-400">Asignado a:</span>
                                                        {client.assigned_coaches.map((ac) => (
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
