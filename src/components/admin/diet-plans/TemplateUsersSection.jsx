import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Users, Copy, ArrowRight, UserCheck, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Link } from 'react-router-dom';
import AssignPlanDialog from './AssignPlanDialog';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TemplateUsersSection = ({ plan, onUpdate }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [adminProfile, setAdminProfile] = useState(null);
    const [preselectedClient, setPreselectedClient] = useState(null);
    const [userToDelete, setUserToDelete] = useState(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('diet_plans')
            .select('id, user_id, profile:user_id(full_name, email)')
            .eq('source_template_id', plan.id);
        
        if (!error) {
            setAssignedUsers(data?.filter(p => p.profile) || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, [plan.id]);

    useEffect(() => {
        if (user) {
            supabase.from('profiles')
                .select('user_id, full_name, email')
                .eq('user_id', user.id)
                .single()
                .then(({ data }) => setAdminProfile(data));
        }
    }, [user]);

    const handleAssignSuccess = () => {
        toast({ title: 'Plan asignado correctamente' });
        setIsAssignDialogOpen(false);
        fetchUsers(); // Refresh list
        if (onUpdate) onUpdate();
        setPreselectedClient(null);
    };

    const handleDeleteAssignment = async () => {
        if (!userToDelete) return;

        try {
            // Call the database function to safely delete the plan and its dependencies
            const { error } = await supabase.rpc('delete_diet_plan_with_dependencies', {
                p_plan_id: userToDelete.planId
            });

            if (error) throw error;

            toast({ title: 'Asignación eliminada', description: `El plan de ${userToDelete.name} ha sido eliminado.` });
            fetchUsers();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error deleting assignment:', error);
            toast({ title: 'Error', description: 'No se pudo eliminar la asignación.', variant: 'destructive' });
        } finally {
            setIsDeleteDialogOpen(false);
            setUserToDelete(null);
        }
    };

    const isAssignedToMe = assignedUsers.some(u => u.user_id === user?.id);

    return (
        <Card className="bg-slate-900/50 border-gray-700 text-white h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xl font-bold text-green-400 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Usuarios de la Plantilla
                </CardTitle>
                <Badge variant="secondary" className="bg-gray-800 text-gray-300">
                    {assignedUsers.length} asignados
                </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="min-h-[100px] max-h-[300px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {loading ? (
                        <p className="text-sm text-gray-500 italic text-center py-4">Cargando usuarios...</p>
                    ) : assignedUsers.length > 0 ? (
                        assignedUsers.map((p) => {
                            const isCurrentUser = user?.id === p.user_id;
                            return (
                                <div key={p.id} className={`flex items-center justify-between p-2 rounded-lg border transition-all group ${
                                    isCurrentUser 
                                        ? 'bg-green-900/20 border-green-500/50 hover:bg-green-900/30' 
                                        : 'bg-[#0F1627] border-gray-800 hover:border-green-500/30 hover:bg-slate-800'
                                }`}>
                                    <Link to={`/admin/manage-diet/${p.user_id}`} className="flex-grow flex flex-col cursor-pointer">
                                        <span className={`text-sm font-medium transition-colors ${
                                            isCurrentUser ? 'text-green-300 font-bold' : 'text-gray-200 group-hover:text-white'
                                        }`}>
                                            {p.profile.full_name} {isCurrentUser && "(Tú)"}
                                        </span>
                                    </Link>
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-7 w-7 p-0 text-gray-500 hover:text-red-400 hover:bg-red-900/20"
                                        onClick={() => {
                                            setUserToDelete({ planId: p.id, name: p.profile.full_name });
                                            setIsDeleteDialogOpen(true);
                                        }}
                                    >
                                        <X size={14} />
                                    </Button>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-6 text-gray-500 border border-dashed border-gray-800 rounded-lg bg-gray-900/20">
                            <p className="text-sm">Ningún usuario asignado todavía.</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    <Button 
                        className="bg-green-600 hover:bg-green-500 text-white"
                        onClick={() => { 
                            setPreselectedClient(null); 
                            setIsAssignDialogOpen(true); 
                        }}
                    >
                        <Copy className="w-4 h-4 mr-2" />
                        Asignar Cliente
                    </Button>
                    <Button 
                        variant="outline"
                        className={`${
                            isAssignedToMe 
                                ? "bg-gray-600/30 border-gray-600/50 text-gray-400 cursor-not-allowed" 
                                : "bg-green-600/30 border-green-600/50 text-green-400 hover:bg-green-600/40 hover:text-green-300"
                        }`}
                        onClick={() => { 
                            if (!isAssignedToMe && adminProfile) {
                                setPreselectedClient(adminProfile);
                                setIsAssignDialogOpen(true);
                            }
                        }}
                        disabled={!adminProfile || isAssignedToMe}
                    >
                        <UserCheck className="w-4 h-4 mr-2" />
                        {isAssignedToMe ? "Ya Asignado" : "Asignarme"}
                    </Button>
                </div>
            </CardContent>

            <AssignPlanDialog
                open={isAssignDialogOpen}
                onOpenChange={setIsAssignDialogOpen}
                template={plan}
                onSuccess={handleAssignSuccess}
                preselectedClient={preselectedClient}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Desasignar plantilla?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Estás a punto de eliminar el plan asignado a <span className="font-bold text-white">{userToDelete?.name}</span>. 
                            Esta acción eliminará permanentemente su plan actual basado en esta plantilla.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAssignment} className="bg-red-600 hover:bg-red-700 text-white">
                            Eliminar Asignación
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
};

export default TemplateUsersSection;