import React, { useState, useMemo } from 'react';
    import { Calendar, momentLocalizer } from 'react-big-calendar';
    import moment from 'moment';
    import 'moment/locale/es';
    import { Button } from '@/components/ui/button';
    import { ChevronLeft, ChevronRight } from 'lucide-react';
    
    moment.locale('es');
    const localizer = momentLocalizer(moment);
    
    const CustomToolbar = ({ label, onNavigate }) => (
        <div className="flex items-center justify-between mb-4 p-2 rounded-lg bg-slate-800/50 border border-slate-700">
            <Button variant="ghost" size="icon" onClick={() => onNavigate('PREV')}>
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <h3 className="text-xl font-bold text-white capitalize">{label}</h3>
            <Button variant="ghost" size="icon" onClick={() => onNavigate('NEXT')}>
                <ChevronRight className="h-5 w-5" />
            </Button>
        </div>
    );
    
    const DietCalendarView = ({ plans, onAssignClick }) => {
        const [date, setDate] = useState(new Date());
    
        const events = useMemo(() => {
            return plans.map(plan => ({
                id: plan.id,
                title: plan.name,
                start: new Date(plan.start_date + 'T00:00:00'),
                end: new Date(plan.end_date + 'T23:59:59'),
                allDay: true,
                resource: plan,
            }));
        }, [plans]);
    
        const eventStyleGetter = (event) => {
            const style = {
                backgroundColor: event.resource.is_active ? '#10B981' : '#6B7280',
                borderRadius: '5px',
                opacity: 0.8,
                color: 'white',
                border: '0px',
                display: 'block',
            };
            return {
                style: style,
            };
        };
    
        const handleSelectSlot = ({ start }) => {
            // This could be used to assign a new plan on a specific date
            // For now, we just open the general assign dialog
            onAssignClick();
        };
    
        return (
            <div className="h-[70vh] bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <Calendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    views={['month']}
                    date={date}
                    onNavigate={newDate => setDate(newDate)}
                    components={{
                        toolbar: CustomToolbar,
                    }}
                    eventPropGetter={eventStyleGetter}
                    onSelectSlot={handleSelectSlot}
                    selectable
                    messages={{
                        today: 'Hoy',
                        previous: 'Anterior',
                        next: 'Siguiente',
                        month: 'Mes',
                        week: 'Semana',
                        day: 'Día',
                        agenda: 'Agenda',
                        date: 'Fecha',
                        time: 'Hora',
                        event: 'Evento',
                        showMore: total => `+${total} más`,
                    }}
                    className="text-white"
                />
            </div>
        );
    };
    
    export default DietCalendarView;