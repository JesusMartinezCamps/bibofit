import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabaseClient';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { StickyNote, Calendar as CalendarIcon, Trash2, Search, User, PlusCircle, Repeat } from 'lucide-react';
import CoachUserList from '@/components/coach/CoachUserList';
import ReminderFormDialog from '@/components/admin/reminders/ReminderFormDialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const CoachRemindersPage = () => {
    const [selectedUser, setSelectedUser] = useState(null);
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingReminder, setEditingReminder] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    const { toast } = useToast();

    useEffect(() => {
        if (selectedUser) {
            fetchReminders();
        } else {
            setReminders([]);
        }
    }, [selectedUser]);

    const fetchReminders = async () => {
        if (!selectedUser) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('reminders')
                .select('*')
                .eq('user_id', selectedUser.user_id)
                .order('start_date', { ascending: false, nullsFirst: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            setReminders(data || []);
        } catch (error) {
            console.error('Error fetching reminders:', error);
            toast({ title: 'Error', description: 'No se pudieron cargar los recordatorios.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const filteredReminders = useMemo(() => {
        return reminders.filter(r => {
            return searchTerm === '' ||
                r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (r.content && r.content.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (r.category && r.category.toLowerCase().includes(searchTerm.toLowerCase()));
        });
    }, [reminders, searchTerm]);

    const handleDelete = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este recordatorio?')) return;
        try {
            const { error } = await supabase.from('reminders').delete().eq('id', id);
            if (error) throw error;
            toast({ title: 'Eliminado', description: 'Recordatorio eliminado correctamente.' });
            fetchReminders();
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo eliminar.', variant: 'destructive' });
        }
    };

    const handleEdit = (reminder) => {
        setEditingReminder(reminder);
        setIsDialogOpen(true);
    };

    const handleNew = () => {
        setEditingReminder(null);
        setIsDialogOpen(true);
    };

    const events = filteredReminders.filter(r => r.type === 'event');
    const notes = filteredReminders.filter(r => r.type === 'note');

    const ReminderCard = ({ reminder }) => {
        const isEvent = reminder.type === 'event';
        const categories = reminder.category ? reminder.category.split(',').map(c => c.trim()) : [];
        
        const badgeClass = isEvent 
            ? "bg-blue-500/10 text-blue-400 border-blue-500/30" 
            : "bg-orange-500/10 text-orange-400 border-orange-500/30";

        const getRecurrenceText = () => {
            if (!reminder.recurrence_type || reminder.recurrence_type === 'none') return null;
            const interval = reminder.recurrence_interval > 1 ? `Cada ${reminder.recurrence_interval} ` : 'Cada ';
            
            switch (reminder.recurrence_type) {
                case 'daily': return interval + (reminder.recurrence_interval > 1 ? 'días' : 'día');
                case 'weekly': return interval + (reminder.recurrence_interval > 1 ? 'semanas' : 'semana');
                case 'monthly': return interval + (reminder.recurrence_interval > 1 ? 'meses' : 'mes');
                case 'yearly': return interval + (reminder.recurrence_interval > 1 ? 'años' : 'año');
                default: return null;
            }
        };
    
        const recurrenceText = getRecurrenceText();

        return (
             <Card 
                className="bg-slate-800/50 border-gray-700 text-white relative group cursor-pointer transition-all hover:border-amber-500/50 hover:bg-slate-800 shadow-sm hover:shadow-md"
                onClick={() => handleEdit(reminder)}
            >
                <CardHeader className="pb-3 pr-10">
                    <CardTitle className="text-lg flex justify-between items-start leading-tight">
                        <span className="flex-1 font-medium">{reminder.title || (isEvent ? 'Evento sin título' : 'Nota sin título')}</span>
                    </CardTitle>
                     {isEvent && reminder.start_date && (
                        <div className="flex flex-col gap-1 mt-1">
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <CalendarIcon size={14} className="text-blue-400" />
                                <span>{format(parseISO(reminder.start_date), 'd MMM', { locale: es })}</span>
                                {reminder.end_date && <span>- {format(parseISO(reminder.end_date), 'd MMM', { locale: es })}</span>}
                            </div>
                            {recurrenceText && (
                                <div className="flex items-center gap-2 text-xs text-blue-300/80 bg-blue-900/20 px-2 py-0.5 rounded-md w-fit">
                                    <Repeat size={12} />
                                    <span>{recurrenceText}</span>
                                </div>
                            )}
                        </div>
                    )}
                </CardHeader>
                <CardContent className="space-y-4">
                    {reminder.content && (
                        <p className="text-gray-300 whitespace-pre-wrap line-clamp-3 text-sm">{reminder.content}</p>
                    )}
                     {categories.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {categories.map((cat, idx) => (
                                <Badge 
                                    key={idx} 
                                    variant="outline"
                                    className={cn("font-normal text-[10px] px-2 py-0.5 h-5", badgeClass)}
                                >
                                    {cat}
                                </Badge>
                            ))}
                        </div>
                    )}
                </CardContent>
                 {/* Delete button always visible (removed opacity classes) */}
                 <div className="absolute top-2 right-2 flex items-center gap-1">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-500/10" 
                        onClick={(e) => { e.stopPropagation(); handleDelete(reminder.id); }}
                    >
                        <Trash2 size={14} />
                    </Button>
                </div>
            </Card>
        );
    };

    return (
        <>
            <Helmet>
                <title>Recordatorios - Entrenador</title>
            </Helmet>
            {/* Main container: Allow vertical scrolling on mobile for the entire page content */}
            <div className="flex flex-col md:flex-row min-h-[calc(100vh-6rem)] gap-6 md:gap-8 md:p-0">
                {/* Sidebar - User List (Stacked on mobile) */}
                <div className="w-full md:w-80 flex-shrink-0 h-64 md:h-full overflow-hidden">
                     <div className="h-full overflow-y-auto rounded-xl border border-gray-800 bg-slate-900/50">
                        <CoachUserList selectedUser={selectedUser} onSelectUser={setSelectedUser} className="border-0 bg-transparent" />
                     </div>
                </div>

                {/* Main Content - Reminders Manager (Flexible height on mobile) */}
                 <div className="flex-grow min-h-[calc(100vh-6rem-2rem)] md:h-full overflow-hidden flex flex-col"> {/* Adjusted height to account for user list on top and overall page padding */}
                    <Card className="bg-slate-900/50 border-gray-700 text-white shadow-xl h-full flex flex-col">
                        <CardHeader className="border-b border-slate-800/60 pb-4 flex-shrink-0">
                            <div className="flex flex-row justify-between items-center">
                                <CardTitle className="text-xl md:text-2xl flex items-center gap-3">
                                    <div className="p-2 bg-green-500/10 rounded-lg">
                                        <User size={20} className="text-green-400" />
                                    </div>
                                    {selectedUser ? (
                                        <div className="flex flex-col">
                                            <span>Recordatorios de </span>
                                            <Link to={`/client-profile/${selectedUser.user_id}`} className="text-sm text-amber-400 hover:text-amber-300 transition-colors font-normal">
                                                {selectedUser.full_name}
                                            </Link>
                                        </div>
                                    ) : 'Gestor de Recordatorios'}
                                </CardTitle>
                                {selectedUser && (
                                    <Button
                                        onClick={handleNew}
                                        className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-900/20 h-9 mt-2 md:h-10 text-sm md:text-base"
                                    >
                                        <PlusCircle className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Nuevo</span><span className="sm:hidden">Crear</span>
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        
                        <CardContent className="pt-6 flex-grow overflow-y-auto custom-scrollbar">
                            {selectedUser ? (
                                <>
                                     <div className="relative flex-grow mb-8">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                        <Input 
                                          placeholder="Buscar por título, detalle o etiqueta..."
                                          value={searchTerm}
                                          onChange={(e) => setSearchTerm(e.target.value)}
                                          className="pl-10 bg-slate-950/30 border-slate-800 focus:border-amber-500/50 transition-colors"
                                        />
                                      </div>

                                    {loading ? (
                                        <div className="flex justify-center items-center py-20"><Loader2 className="w-12 h-12 animate-spin text-amber-500" /></div>
                                    ) : (
                                        <div className="space-y-10 pb-8">
                                            {/* Notes Section */}
                                            <div>
                                                <h3 className="text-lg font-semibold mb-4 pb-2 flex items-center gap-2 text-amber-400/90">
                                                    <StickyNote size={18} /> Notas Generales
                                                    <span className="text-xs bg-slate-800 text-gray-400 px-2 py-0.5 rounded-full ml-2">{notes.length}</span>
                                                </h3>
                                                {notes.length > 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {notes.map(r => <ReminderCard key={r.id} reminder={r} />)}
                                                    </div>
                                                ) : (
                                                    <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-gray-500 bg-slate-900/20">
                                                        <p>No hay notas creadas aún.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Events Section */}
                                            <div>
                                                 <h3 className="text-lg font-semibold mb-4 pb-2 flex items-center gap-2 text-blue-400/90">
                                                    <CalendarIcon size={18} /> Eventos
                                                    <span className="text-xs bg-slate-800 text-gray-400 px-2 py-0.5 rounded-full ml-2">{events.length}</span>
                                                </h3>
                                                {events.length > 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {events.map(r => <ReminderCard key={r.id} reminder={r} />)}
                                                    </div>
                                                ) : (
                                                    <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-gray-500 bg-slate-900/20">
                                                        <p>No hay eventos programados.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-20">
                                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <User className="w-10 h-10 text-slate-600" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-300">Sin cliente seleccionado</h3>
                                    <p className="text-gray-500 mt-1">Selecciona un cliente de la lista para gestionar sus recordatorios.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <ReminderFormDialog 
                isOpen={isDialogOpen} 
                onOpenChange={setIsDialogOpen} 
                onSave={() => { setIsDialogOpen(false); fetchReminders(); }}
                reminder={editingReminder}
                userId={selectedUser?.user_id}
            />
        </>
    );
};

export default CoachRemindersPage;