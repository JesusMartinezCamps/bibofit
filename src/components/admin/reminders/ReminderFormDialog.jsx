import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, X, Check, Trash2, Repeat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const DEFAULT_CATEGORIES = ['Dieta', 'Entreno', 'Personal', 'Salud', 'Objetivos', 'Mascotas', 'Viajes', 'Cumpleaños'];
const DAYS_OF_WEEK = [
  { value: '1', label: 'L' },
  { value: '2', label: 'M' },
  { value: '3', label: 'X' },
  { value: '4', label: 'J' },
  { value: '5', label: 'V' },
  { value: '6', label: 'S' },
  { value: '0', label: 'D' },
];

const ReminderFormDialog = ({ isOpen, onOpenChange, onSave, reminder, userId, newReminderPrefill }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEvent, setIsEvent] = useState(false);
  const [hasEndDate, setHasEndDate] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  
  // Recurrence state
  const [recurrenceType, setRecurrenceType] = useState('none');
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(null);
  // Monthly specific
  const [monthlyType, setMonthlyType] = useState('date'); // 'date' (e.g. 15th) or 'relative' (e.g. 1st Monday)
  const [recurrenceMonthDay, setRecurrenceMonthDay] = useState(1);
  const [recurrenceWeekNo, setRecurrenceWeekNo] = useState(1); // 1=First, 2=Second, ..., -1=Last
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState(1); // 0=Sun, 1=Mon...
  
  // Categories state
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [availableCategories, setAvailableCategories] = useState(DEFAULT_CATEGORIES);
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset to defaults
      setAvailableCategories(DEFAULT_CATEGORIES);
      setIsDeleteMode(false);
      setRecurrenceType('none');
      setRecurrenceDays([]);
      setRecurrenceInterval(1);
      setRecurrenceEndDate(null);
      setMonthlyType('date');
      setRecurrenceMonthDay(1);
      setRecurrenceWeekNo(1);
      setRecurrenceDayOfWeek(1);

      if (reminder) {
        setIsEvent(reminder.type === 'event');
        setTitle(reminder.title || '');
        setContent(reminder.content || '');
        setStartDate(reminder.start_date ? new Date(reminder.start_date) : null);
        setHasEndDate(Boolean(reminder.end_date));
        setEndDate(reminder.end_date ? new Date(reminder.end_date) : null);

        // Parse recurrence
        setRecurrenceType(reminder.recurrence_type || 'none');
        setRecurrenceDays(reminder.recurrence_days ? reminder.recurrence_days.split(',') : []);
        setRecurrenceInterval(reminder.recurrence_interval || 1);
        setRecurrenceEndDate(reminder.recurrence_end_date ? new Date(reminder.recurrence_end_date) : null);
        setRecurrenceMonthDay(reminder.recurrence_month_day || 1);
        setRecurrenceWeekNo(reminder.recurrence_week_no || 1);
        setRecurrenceDayOfWeek(reminder.recurrence_day_of_week || 1);
        
        // If monthly relative was saved, detect it
        if (reminder.recurrence_type === 'monthly' && reminder.recurrence_week_no) {
            setMonthlyType('relative');
        }

        // Parse categories
        const cats = reminder.category 
          ? reminder.category.split(',').map(c => c.trim()).filter(Boolean) 
          : ['Personal'];
        
        setSelectedCategories(cats);
        setAvailableCategories(prev => {
          const unique = new Set([...prev, ...cats]);
          return Array.from(unique);
        });

      } else if (newReminderPrefill) {
        setIsEvent(true);
        setTitle('');
        setContent('');
        setStartDate(newReminderPrefill.startDate || new Date());
        setEndDate(null);
        setHasEndDate(false);
        setSelectedCategories(['Personal']);
      } else {
        setIsEvent(false);
        setTitle('');
        setContent('');
        setStartDate();
        setEndDate(null);
        setHasEndDate(false);
        setSelectedCategories(['Personal']);
      }
      
      setIsAddingCategory(false);
      setNewCategoryName('');
    }
  }, [reminder, isOpen, newReminderPrefill]);

  const toggleCategory = (cat) => {
    if (isDeleteMode) {
        if (window.confirm(`¿Estás seguro de eliminar la categoría "${cat}" de la lista?`)) {
             setAvailableCategories(prev => prev.filter(c => c !== cat));
             setSelectedCategories(prev => prev.filter(c => c !== cat));
        }
        return;
    }

    setSelectedCategories(prev => {
      if (prev.includes(cat)) {
        return prev.filter(c => c !== cat);
      } else {
        return [...prev, cat];
      }
    });
  };

  const toggleRecurrenceDay = (dayVal) => {
    setRecurrenceDays(prev => {
      if (prev.includes(dayVal)) return prev.filter(d => d !== dayVal);
      return [...prev, dayVal];
    });
  };

  const handleAddCustomCategory = () => {
    if (newCategoryName.trim()) {
      const trimmedName = newCategoryName.trim();
      if (!availableCategories.includes(trimmedName)) {
        setAvailableCategories(prev => [...prev, trimmedName]);
      }
      if (!selectedCategories.includes(trimmedName)) {
        setSelectedCategories(prev => [...prev, trimmedName]);
      }
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({ title: 'Error', description: 'El título es obligatorio.', variant: 'destructive' });
      return;
    }

    if (selectedCategories.length === 0) {
      toast({ title: 'Error', description: 'Debes seleccionar al menos una categoría.', variant: 'destructive' });
      return;
    }
    
    // Validate Recurrence
    if (isEvent && recurrenceType !== 'none') {
        if (!recurrenceInterval || isNaN(parseInt(recurrenceInterval)) || parseInt(recurrenceInterval) < 1) {
            toast({ title: 'Error', description: 'El intervalo de repetición es obligatorio y debe ser mayor a 0.', variant: 'destructive' });
            return;
        }

        if (recurrenceType === 'weekly' && recurrenceDays.length === 0) {
            toast({ title: 'Error', description: 'Selecciona al menos un día para la frecuencia semanal.', variant: 'destructive' });
            return;
        }
    }

    setIsSubmitting(true);

    const reminderData = {
      user_id: userId,
      admin_id: user.id,
      title: title.trim(),
      content: content.trim(), 
      type: isEvent ? 'event' : 'note',
      start_date: isEvent ? startDate : null,
      end_date: isEvent && hasEndDate ? endDate : null,
      category: selectedCategories.join(','),
      
      // Recurrence fields
      recurrence_type: isEvent ? recurrenceType : null,
      recurrence_days: isEvent && recurrenceType === 'weekly' ? recurrenceDays.join(',') : null,
      recurrence_interval: isEvent && recurrenceType !== 'none' ? parseInt(recurrenceInterval) : null,
      recurrence_end_date: isEvent && recurrenceType !== 'none' ? recurrenceEndDate : null,
      recurrence_month_day: isEvent && (recurrenceType === 'monthly' && monthlyType === 'date') ? recurrenceMonthDay : null,
      recurrence_week_no: isEvent && recurrenceType === 'monthly' && monthlyType === 'relative' ? recurrenceWeekNo : null,
      recurrence_day_of_week: isEvent && recurrenceType === 'monthly' && monthlyType === 'relative' ? recurrenceDayOfWeek : null,
    };

    try {
      let response;
      if (reminder) {
        response = await supabase.from('reminders').update(reminderData).eq('id', reminder.id);
      } else {
        response = await supabase.from('reminders').insert(reminderData);
      }

      if (response.error) throw response.error;

      toast({ title: 'Éxito', description: `Recordatorio ${reminder ? 'actualizado' : 'creado'}.` });
      onSave();

    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });

    } finally {
      setIsSubmitting(false);
    }
  };

  const noteCategoryClass = "bg-orange-500/20 text-orange-300 border-orange-500/50 hover:bg-orange-500/30";
  const eventCategoryClass = "bg-blue-500/20 text-blue-300 border-blue-500/50 hover:bg-blue-500/30";

  const noteSubmitBtnClass = "bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700 shadow-lg shadow-amber-900/20";
  const eventSubmitBtnClass = "bg-gradient-to-r from-blue-600 to-blue-800 text-white hover:from-blue-700 hover:to-blue-900 shadow-lg shadow-blue-900/20";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-slate-900 border-gray-700 text-white max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{reminder ? 'Editar' : 'Nuevo'} Recordatorio</DialogTitle>
          <DialogDescription>Gestiona eventos, notas importantes y recurrencias para tu cliente.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-5 py-2 custom-scrollbar">
            
            {/* Toggle Nota / Evento */}
            <div className="flex items-center justify-end space-x-3 mt-2 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 w-fit ml-auto">
              <Label className={cn("cursor-pointer transition-colors", !isEvent ? 'text-amber-400 font-semibold' : 'text-gray-400')} onClick={() => setIsEvent(false)}>Nota</Label>
              <Switch checked={isEvent} onCheckedChange={setIsEvent} className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-amber-500" />
              <Label className={cn("cursor-pointer transition-colors", isEvent ? 'text-blue-400 font-semibold' : 'text-gray-400')} onClick={() => setIsEvent(true)}>Evento</Label>
            </div>

            {/* EVENT FIELDS */}
            {isEvent && (
              <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-300 p-4 bg-slate-950/30 rounded-xl border border-slate-800/50">
                <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <Label>{hasEndDate ? 'Rango de fechas' : 'Fecha del evento'}</Label>
                          <div className="flex items-center space-x-2">
                              <Label className="text-xs text-gray-400 cursor-pointer" htmlFor="range-switch">Rango</Label>
                              <Switch id="range-switch" checked={hasEndDate} onCheckedChange={setHasEndDate} className="scale-75" />
                          </div>
                      </div>
                      {hasEndDate ? (
                          <DatePicker
                              selectsRange
                              startDate={startDate}
                              endDate={endDate}
                              onChange={([start, end]) => {
                              setStartDate(start);
                              setEndDate(end);
                              }}
                              dateFormat="dd/MM/yyyy"
                              locale={es}
                              className="input-field w-full text-center"
                              placeholderText="Selecciona inicio y fin"
                          />
                      ) : (
                          <DatePicker
                              selected={startDate}
                              onChange={setStartDate}
                              dateFormat="dd/MM/yyyy"
                              locale={es}
                              className="input-field w-full"
                              placeholderText="Selecciona una fecha"
                          />
                      )}
                    </div>
                </div>

                {/* RECURRENCE SECTION */}
                <div className="space-y-3 border-t border-slate-800 pt-4 mt-2">
                    <div className="flex items-center gap-2">
                         <Repeat className="w-4 h-4 text-blue-400" />
                         <Label>Frecuencia de Repetición</Label>
                    </div>
                    <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                        <SelectTrigger className="bg-slate-900 border-slate-700">
                            <SelectValue placeholder="Sin repetición" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-white">
                            <SelectItem value="none">No se repite</SelectItem>
                            <SelectItem value="daily">Diariamente</SelectItem>
                            <SelectItem value="weekly">Semanalmente</SelectItem>
                            <SelectItem value="monthly">Mensualmente</SelectItem>
                            <SelectItem value="yearly">Anualmente</SelectItem>
                        </SelectContent>
                    </Select>

                    {recurrenceType !== 'none' && (
                        <div className="space-y-4 pl-6 border-l-2 border-blue-500/20 ml-2 mt-2 animate-in fade-in slide-in-from-left-2">
                            {/* Interval setting */}
                            <div className="flex items-center gap-3">
                                <Label className="text-xs text-gray-400">Repetir cada</Label>
                                <Input 
                                    type="number" 
                                    min="1" 
                                    value={recurrenceInterval} 
                                    onChange={(e) => setRecurrenceInterval(e.target.value)}
                                    className="w-16 h-8 text-center bg-slate-900 border-slate-700"
                                />
                                <Label className="text-xs text-gray-400">
                                    {recurrenceType === 'daily' ? 'días' : 
                                     recurrenceType === 'weekly' ? 'semanas' : 
                                     recurrenceType === 'monthly' ? 'meses' : 'años'}
                                </Label>
                            </div>

                            {/* Weekly specific: Days selection */}
                            {recurrenceType === 'weekly' && (
                                <div className="space-y-2">
                                    <Label className="text-xs text-gray-400">Días de la semana:</Label>
                                    <div className="flex gap-1 flex-wrap">
                                        {DAYS_OF_WEEK.map((day) => (
                                            <button
                                                key={day.value}
                                                type="button"
                                                onClick={() => toggleRecurrenceDay(day.value)}
                                                className={cn(
                                                    "w-8 h-8 rounded-full text-xs font-medium transition-colors border",
                                                    recurrenceDays.includes(day.value) 
                                                        ? "bg-blue-600 border-blue-500 text-white" 
                                                        : "bg-slate-900 border-slate-700 text-gray-400 hover:bg-slate-800"
                                                )}
                                            >
                                                {day.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Monthly specific */}
                            {recurrenceType === 'monthly' && (
                                <div className="space-y-3">
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="radio" 
                                                id="monthly-date" 
                                                checked={monthlyType === 'date'} 
                                                onChange={() => setMonthlyType('date')}
                                                className="accent-blue-500"
                                            />
                                            <Label htmlFor="monthly-date" className="text-sm cursor-pointer">Por día del mes</Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="radio" 
                                                id="monthly-relative" 
                                                checked={monthlyType === 'relative'} 
                                                onChange={() => setMonthlyType('relative')}
                                                className="accent-blue-500"
                                            />
                                            <Label htmlFor="monthly-relative" className="text-sm cursor-pointer">Por día relativo</Label>
                                        </div>
                                    </div>
                                    
                                    {monthlyType === 'date' ? (
                                        <div className="flex items-center gap-2">
                                            <Label className="text-xs text-gray-400">El día</Label>
                                            <Input 
                                                type="number" 
                                                min="1" 
                                                max="31"
                                                value={recurrenceMonthDay} 
                                                onChange={(e) => setRecurrenceMonthDay(parseInt(e.target.value) || 1)}
                                                className="w-16 h-8 text-center bg-slate-900 border-slate-700"
                                            />
                                            <Label className="text-xs text-gray-400">de cada mes</Label>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Label className="text-xs text-gray-400">El</Label>
                                            <Select value={recurrenceWeekNo.toString()} onValueChange={(v) => setRecurrenceWeekNo(parseInt(v))}>
                                                <SelectTrigger className="w-[110px] h-8 bg-slate-900 border-slate-700 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-800 border-slate-700">
                                                    <SelectItem value="1">Primer</SelectItem>
                                                    <SelectItem value="2">Segundo</SelectItem>
                                                    <SelectItem value="3">Tercer</SelectItem>
                                                    <SelectItem value="4">Cuarto</SelectItem>
                                                    <SelectItem value="-1">Último</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Select value={recurrenceDayOfWeek.toString()} onValueChange={(v) => setRecurrenceDayOfWeek(parseInt(v))}>
                                                <SelectTrigger className="w-[110px] h-8 bg-slate-900 border-slate-700 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-800 border-slate-700">
                                                    <SelectItem value="1">Lunes</SelectItem>
                                                    <SelectItem value="2">Martes</SelectItem>
                                                    <SelectItem value="3">Miércoles</SelectItem>
                                                    <SelectItem value="4">Jueves</SelectItem>
                                                    <SelectItem value="5">Viernes</SelectItem>
                                                    <SelectItem value="6">Sábado</SelectItem>
                                                    <SelectItem value="0">Domingo</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Label className="text-xs text-gray-400">del mes</Label>
                                        </div>
                                    )}
                                </div>
                            )}

                             {/* Yearly specific info */}
                             {recurrenceType === 'yearly' && (
                                <div className="text-xs text-gray-400 italic p-2 bg-slate-900/50 rounded border border-slate-800">
                                    El evento se repetirá {recurrenceInterval > 1 ? `cada ${recurrenceInterval} años` : 'anualmente'} en la fecha: <span className="text-white font-medium">{startDate ? format(startDate, 'dd/MM/yyyy') : '...'}</span>
                                </div>
                             )}

                            {/* End date for recurrence */}
                            <div className="pt-2">
                                <Label className="text-xs text-gray-400 block mb-1">Terminar repetición (opcional):</Label>
                                <DatePicker
                                    selected={recurrenceEndDate}
                                    onChange={setRecurrenceEndDate}
                                    dateFormat="dd/MM/yyyy"
                                    locale={es}
                                    isClearable
                                    placeholderText="Nunca"
                                    className="input-field w-full h-8 text-sm bg-slate-900"
                                />
                            </div>
                        </div>
                    )}
                </div>
              </div>
            )}

            {/* TÍTULO (Required) */}
            <div className="space-y-2">
              <Label htmlFor="title" className="flex items-center gap-1">
                  Título <span className="text-red-400">*</span>
              </Label>
              <Input 
                  id="title" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder={isEvent ? "Ej: Revisión presencial" : "Hay que recordar que..."} 
                  className="bg-slate-950/50 border-slate-700 focus:ring-offset-0"
              />
            </div>

            {/* CONTENIDO (Optional) -> Detalle */}
            <div className="space-y-2">
              <Label htmlFor="content">Detalles <span className="text-gray-500 text-xs font-normal ml-1">(opcional)</span></Label>
              <Textarea 
                  id="content" 
                  value={content} 
                  onChange={(e) => setContent(e.target.value)} 
                  placeholder="Información adicional..." 
                  className="bg-slate-950/50 border-slate-700 min-h-[100px] resize-none" 
              />
            </div>

            {/* CATEGORÍAS (Checkbox/Tags) */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Categorías</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsDeleteMode(!isDeleteMode)}
                  className={cn("h-6 px-2 text-xs", isDeleteMode ? "text-red-400 bg-red-700/20 hover:text-gray-300 hover:bg-red-900/30" : "text-gray-500 hover:bg-red-900/30 hover:text-gray-300")}
                >
                  {isDeleteMode ? 'Terminar' : 'Eliminar'}
                </Button>
              </div>
              
              <div className={cn("flex flex-wrap gap-2 p-3 bg-slate-950/30 rounded-xl border border-slate-800/60 min-h-[3rem] items-center transition-colors", isDeleteMode && "border-red-900/30 bg-red-950/10")}>
                {availableCategories.map((cat) => {
                  const isSelected = selectedCategories.includes(cat);
                  
                  let badgeClass = "";
                  if (isDeleteMode) {
                      badgeClass = "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/30 cursor-pointer";
                  } else {
                      if (isSelected) {
                          badgeClass = isEvent ? eventCategoryClass : noteCategoryClass;
                      } else {
                          badgeClass = "bg-slate-800 text-gray-400 border-slate-700 hover:bg-slate-700 hover:text-gray-200 cursor-pointer";
                      }
                  }

                  return (
                    <Badge
                      key={cat}
                      variant="outline"
                      onClick={() => toggleCategory(cat)}
                      className={cn(
                        "px-3 py-1.5 text-xs transition-all select-none border",
                        !isDeleteMode && "hover:scale-105 active:scale-95",
                        badgeClass,
                        isDeleteMode && "animate-in fade-in zoom-in duration-200"
                      )}
                    >
                      {isDeleteMode && <X className="w-3 h-3 mr-1.5 inline-block" />}
                      {!isDeleteMode && isSelected && <Check className="w-3 h-3 mr-1.5 inline-block" />}
                      {cat}
                    </Badge>
                  );
                })}

                {!isDeleteMode && (
                  <>
                    {isAddingCategory ? (
                      <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                        <Input 
                          autoFocus
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddCustomCategory();
                              } else if (e.key === 'Escape') {
                                  setIsAddingCategory(false);
                                  setNewCategoryName('');
                              }
                          }}
                          className="h-7 text-xs w-24 px-2 bg-slate-800 border-slate-600"
                          placeholder="Nueva..."
                        />
                        <Button size="icon" type="button" variant="ghost" onClick={handleAddCustomCategory} className="h-7 w-7 hover:bg-green-500/20 hover:text-green-400">
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="icon" type="button" variant="ghost" onClick={() => setIsAddingCategory(false)} className="h-7 w-7 hover:bg-red-500/20 hover:text-red-400">
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsAddingCategory(true)}
                        className="h-7 px-2 text-xs border border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 hover:bg-slate-800 rounded-full"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Agregar
                      </Button>
                    )}
                  </>
                )}
              </div>
              <p className="text-[10px] text-gray-500 pl-1">
                 {isDeleteMode 
                    ? "Haz clic en una categoría para eliminarla de la lista." 
                    : "Selecciona etiquetas para organizar."}
              </p>
            </div>
          </div>

          <DialogFooter className="mt-4 flex-shrink-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="hover:bg-slate-800 text-gray-400 hover:text-white">
                Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className={isEvent ? eventSubmitBtnClass : noteSubmitBtnClass}>
              {isSubmitting ? (
                  <>Guardando...</> 
              ) : (
                  <>{reminder ? 'Guardar Cambios' : 'Crear Recordatorio'}</>
              )}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReminderFormDialog;