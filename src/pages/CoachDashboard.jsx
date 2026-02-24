import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import CoachUserList from '@/components/coach/CoachUserList';
import SharedCalendar from '@/components/shared/SharedCalendar';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, StickyNote, Calendar as CalendarIcon, Clock, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import ReminderFormDialog from '@/components/admin/reminders/ReminderFormDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button'; // Import Button component

const CoachDashboard = () => {
    const [selectedUser, setSelectedUser] = useState(null);
    const [clientNotes, setClientNotes] = useState([]);
    const [upcomingEvents, setUpcomingEvents] = useState([]);
    const [reminderRefreshToken, setReminderRefreshToken] = useState(0);
    const navigate = useNavigate(); // Initialize useNavigate
    const [isMobile, setIsMobile] = useState(false);
    
    // Modal state for editing reminders
    const [isReminderFormOpen, setIsReminderFormOpen] = useState(false);
    const [editingReminder, setEditingReminder] = useState(null);

    // Collapsible states
    const [isNotesOpen, setIsNotesOpen] = useState(true);
    const [isEventsOpen, setIsEventsOpen] = useState(true);

  // Track screen size for collapsible defaults
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  
  }, []);

    const fetchDashboardData = async () => {
        if (!selectedUser) return;

        const today = new Date().toISOString().split('T')[0];

        // Fetch Notes (Type: note)
        const { data: notes } = await supabase
           .from('reminders')
           .select('*')
           .eq('user_id', selectedUser.user_id)
           .eq('type', 'note')
           .order('created_at', { ascending: false });
       
       if (notes) setClientNotes(notes);

       // Fetch Upcoming Events (Type: event)
       const { data: events } = await supabase
           .from('reminders')
           .select('*')
           .eq('user_id', selectedUser.user_id)
           .eq('type', 'event')
           .gte('start_date', today)
           .order('start_date', { ascending: true })
           .limit(5);

       if (events) setUpcomingEvents(events);
   };

    useEffect(() => {
        if (!selectedUser) {
            setClientNotes([]);
          setUpcomingEvents([]);

          setIsNotesOpen(false);
          setIsEventsOpen(false);
            return;
        }
        fetchDashboardData();
    }, [selectedUser]);
  useEffect(() => {
    const today = new Date();
    const hasTodayEvent = upcomingEvents.some(event => isSameDay(new Date(event.start_date), today));
    const hasNotes = clientNotes.length > 0;
    const hasEvents = upcomingEvents.length > 0;

    const shouldOpenNotes = (hasTodayEvent || !isMobile) && hasNotes;
    const shouldOpenEvents = (hasTodayEvent || !isMobile) && hasEvents;

    setIsNotesOpen(shouldOpenNotes);
    setIsEventsOpen(shouldOpenEvents);
  }, [clientNotes.length, upcomingEvents, isMobile]);


    const handleEditReminder = (reminder) => {
        setEditingReminder(reminder);
        setIsReminderFormOpen(true);
    };
    const handleReminderRefresh = async () => {
        await fetchDashboardData();
        setReminderRefreshToken((prev) => prev + 1);
    };
    const handleReminderSave = () => {
        setIsReminderFormOpen(false);
        setEditingReminder(null);
        handleReminderRefresh();
    };

    return (
        <>
            <Helmet>
                <title>Dashboard Entrenador - Gsus Martz</title>
            </Helmet>
            <div className="flex flex-col md:flex-row gap-6 p-4 md:p-6 max-w-[1800px] mx-auto">
                {/* Sidebar: Client List */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full md:w-80 flex-shrink-0 md:sticky md:top-24 h-fit md:h-[calc(100vh-120px)]"
                >
                    <CoachUserList 
                        selectedUser={selectedUser} 
                        onSelectUser={setSelectedUser}
                        className="h-auto md:h-full"
                    />
                </motion.div>

                {/* Main Content */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="flex-grow min-w-0 flex flex-col gap-6"
                >
                    {/* Compact Sections (Notes & Events) - Now ABOVE Calendar */}
                    {selectedUser && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Notes Section */}
                            <Collapsible 
                                open={isNotesOpen} 
                                onOpenChange={setIsNotesOpen}
                                className="bg-[#a9973e0d] rounded-2xl border border-amber-500/20 shadow-lg flex flex-col h-fit overflow-hidden transition-all duration-300"
                            >
                                <CollapsibleTrigger className="w-full p-6 flex items-center justify-between hover:bg-amber-500/5 transition-colors cursor-pointer text-left group">
                                    <div className="flex items-center gap-2">
                                        <StickyNote className="w-5 h-5 text-amber-400" />
                                        <h3 className="text-xl font-bold text-white group-hover:text-amber-200 transition-colors">
                                            Recordatorios del cliente
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10">
                                            {clientNotes.length}
                                        </Badge>
                                        {isNotesOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                    </div>
                                </CollapsibleTrigger>
                                
                                <CollapsibleContent>
                                    <div className="px-6 pb-6 pt-0 space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        {clientNotes.length > 0 ? (
                                            clientNotes.map((note) => (
                                                <div 
                                                    key={note.id} 
                                                    onClick={(e) => { e.stopPropagation(); handleEditReminder(note); }}
                                                    className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50 hover:border-amber-500/50 hover:bg-slate-800/80 transition-all group cursor-pointer"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h4 className="font-semibold text-amber-200 group-hover:text-amber-100 transition-colors">{note.title}</h4>
                                                        <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                                                            {format(new Date(note.created_at), 'd MMM', { locale: es })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                                                    {note.category && (
                                                        <div className="flex flex-wrap gap-1 mt-3">
                                                            {note.category.split(',').map((cat, idx) => (
                                                                <span key={idx} className="text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 flex items-center">
                                                                    <Tag className="w-2.5 h-2.5 mr-1" />
                                                                    {cat}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-6 text-center text-gray-500">
                                                <StickyNote className="w-8 h-8 mb-2 opacity-20" />
                                                <p className="text-sm">No hay notas para este cliente.</p>
                                            </div>
                                        )}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>

                            {/* Events Section */}
                            <Collapsible
                                open={isEventsOpen}
                                onOpenChange={setIsEventsOpen}
                                className="bg-[#3e5aa90f] rounded-2xl border border-blue-500/20 shadow-lg flex flex-col h-fit overflow-hidden transition-all duration-300"
                            >
                                <CollapsibleTrigger className="w-full p-6 flex items-center justify-between hover:bg-blue-500/5 transition-colors cursor-pointer text-left group">
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon className="w-5 h-5 text-blue-400" />
                                        <h3 className="text-xl font-bold text-white group-hover:text-blue-200 transition-colors">
                                            Próximos Eventos
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10">
                                            {upcomingEvents.length}
                                        </Badge>
                                        {isEventsOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                    </div>
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                    <div className="px-6 pb-6 pt-0 space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        {upcomingEvents.length > 0 ? (
                                            upcomingEvents.map((event) => (
                                                <div 
                                                    key={event.id} 
                                                    onClick={(e) => { e.stopPropagation(); handleEditReminder(event); }}
                                                    className="flex items-center gap-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800/50 hover:bg-slate-800 hover:border-blue-500/30 transition-all cursor-pointer"
                                                >
                                                    <div className="flex-shrink-0 w-14 text-center bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-lg py-2 border border-blue-500/20 shadow-sm">
                                                        <span className="block text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                                                            {format(new Date(event.start_date), 'MMM', { locale: es })}
                                                        </span>
                                                        <span className="block text-2xl font-black text-blue-400 leading-none mt-0.5">
                                                            {format(new Date(event.start_date), 'd')}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="font-medium text-white truncate">{event.title}</h4>
                                                        {event.content && (
                                                            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{event.content}</p>
                                                        )}
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <Clock className="w-3 h-3 text-slate-500" />
                                                            <span className="text-[10px] text-slate-500 capitalize">
                                                                {format(new Date(event.start_date), 'EEEE d \'de\' MMMM', { locale: es })}
                                                                {event.end_date && ` - ${format(new Date(event.end_date), 'EEEE d \'de\' MMMM', { locale: es })}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-6 text-center text-gray-500">
                                                <CalendarIcon className="w-8 h-8 mb-2 opacity-20" />
                                                <p className="text-sm">No hay eventos próximos.</p>
                                            </div>
                                        )}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        </div>
                    )}

                    {/* Calendar Section */}
                    <div className="bg-[#1a1e23] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
                         {selectedUser ? (
                            <div className="flex flex-col">
                                 <div className="p-4 md:p-6 pb-4">
                                    <div className="flex items-center justify-between flex-wrap gap-4">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                                Calendario de <Link to={`/client-profile/${selectedUser.user_id}`} className="text-green-400 hover:underline cursor-pointer">{selectedUser.full_name}</Link>
                                            </h2>
                                            {/* Button for Diet Plan Manager */}
                                            <Button
                                                size="sm"
                                                variant="outline-profile"
                                                onClick={() => navigate(`/admin/manage-diet/${selectedUser.user_id}`)}
                                                className="mt-2 text-xs sm:text-sm bg-gradient-to-br from-[rgb(66_52_143_/50%)] to-emerald-300/0"
                                            >
                                                Gestor de Planes de Dieta
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 md:p-6 pt-0">
                                    <div className="min-h-[700px]">
                                       <SharedCalendar
                                            userId={selectedUser.user_id}
                                            onRemindersChanged={handleReminderRefresh}
                                            refreshTrigger={reminderRefreshToken}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-[400px] md:h-[700px] flex items-center justify-center p-8">
                                <Alert className="bg-slate-800/50 border-slate-700 max-w-md">
                                    <Info className="h-4 w-4 text-blue-400" />
                                    <AlertTitle className="text-white mb-2">Selecciona un Cliente</AlertTitle>
                                    <AlertDescription className="text-gray-400">
                                        Selecciona un cliente de la lista para ver su calendario, entrenamientos y registros.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Editing Reminder Modal */}
            {selectedUser && (
                <ReminderFormDialog
                    isOpen={isReminderFormOpen}
                    onOpenChange={setIsReminderFormOpen}
                    onSave={handleReminderSave}
                    reminder={editingReminder}
                    userId={selectedUser.user_id}
                />
            )}
        </>
    );
};

export default CoachDashboard;