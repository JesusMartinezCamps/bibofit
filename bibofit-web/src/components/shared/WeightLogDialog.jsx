import React, { useState, useEffect, useCallback } from 'react';
    import { useAuth } from '@/contexts/AuthContext';
    import { supabase } from '@/lib/supabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { Label } from '@/components/ui/label';
    import { Loader2, CheckCircle, Trash2, CalendarPlus as CalendarIcon } from 'lucide-react';
    import { motion, AnimatePresence } from 'framer-motion';
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
    import ViewModeToggle from '@/components/shared/AdminViewToggle';
    import DatePicker from 'react-datepicker';
    import { format } from 'date-fns';
    import { es } from 'date-fns/locale';

    const WeightLogDialog = ({ open, onOpenChange, onLogAdded, initialDate, userId: propUserId }) => {
      const { user: authUser } = useAuth();
      const { toast } = useToast();
      const [weight, setWeight] = useState('');
      const [comment, setComment] = useState('');
      const [satietyLevelId, setSatietyLevelId] = useState(null);
      const [satietyLevels, setSatietyLevels] = useState([]);
      const [loading, setLoading] = useState(true);
      const [mode, setMode] = useState('settings');
      const [logId, setLogId] = useState(null);
      const [hasChanges, setHasChanges] = useState(false);
      
      const [logDate, setLogDate] = useState(initialDate || new Date());
      const [displayDate, setDisplayDate] = useState(initialDate || new Date());

      const userId = propUserId || authUser?.id;
      const isAdminView = propUserId && authUser?.role === 'admin';

      useEffect(() => {
        if (open) {
          const newInitialDate = initialDate || new Date();
          setLogDate(newInitialDate);
          setDisplayDate(newInitialDate);
        }
      }, [open, initialDate]);

      useEffect(() => {
        const fetchSatietyLevels = async () => {
          try {
            const { data, error } = await supabase
              .from('satiety_levels')
              .select('*')
              .order('value', { ascending: true });

            if (error) throw error;
            setSatietyLevels(data);
          } catch (error) {
            console.error('Error fetching satiety levels:', error);
            setSatietyLevels([]);
          }
        };

        fetchSatietyLevels();
      }, []);

      const fetchExistingLog = useCallback(async () => {
        if (!open || !userId || !displayDate) {
          setWeight('');
          setComment('');
          setSatietyLevelId(null);
          setLogId(null);
          setMode('settings');
          setHasChanges(false);
          return;
        }
        
        const queryDate = format(displayDate, 'yyyy-MM-dd');

        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('weight_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('logged_on', queryDate)
            .maybeSingle();

          if (error) throw error;

          if (data) {
            setWeight(data.weight_kg.toString());
            setComment(data.description || '');
            setSatietyLevelId(data.satiety_level_id || null);
            setLogId(data.id);
            setMode('view');
          } else {
            setWeight('');
            setComment('');
            setSatietyLevelId(null);
            setLogId(null);
            setMode('settings');
          }
        } catch (error) {
          console.error('Error in fetchExistingLog:', error);
          setWeight('');
          setComment('');
          setSatietyLevelId(null);
          setLogId(null);
          setMode('settings');
        } finally {
          setLoading(false);
          setHasChanges(false);
        }
      }, [open, userId, displayDate]);

      useEffect(() => {
        fetchExistingLog();
      }, [fetchExistingLog]);

      const handleModeChange = async (checked) => {
        const newMode = checked ? 'view' : 'settings';
        if (mode === 'settings' && newMode === 'view' && hasChanges) {
          await handleSubmit();
        } else {
          setMode(newMode);
        }
      };

      const handleClose = () => {
        if (loading) return;
        onOpenChange(false);
      };

      const handleSubmit = async () => {
        if (!weight || isNaN(parseFloat(weight))) {
          toast({
            title: 'Error de validación',
            description: 'Por favor, introduce un peso válido.',
            variant: 'destructive',
          });
          setMode('settings');
          return;
        }

        setLoading(true);
        
        try {
          const loggedOnDate = format(logDate, 'yyyy-MM-dd');

          const logData = {
            user_id: userId,
            weight_kg: parseFloat(weight),
            description: comment,
            logged_on: loggedOnDate,
            satiety_level_id: satietyLevelId,
          };

          let error;
          let savedData;
          if (logId && format(logDate, 'yyyy-MM-dd') === format(displayDate, 'yyyy-MM-dd')) {
            const { data, error: updateError } = await supabase.from('weight_logs').update(logData).eq('id', logId).select().single();
            error = updateError;
            savedData = data;
          } else {
            if (logId) {
              await supabase.from('weight_logs').delete().eq('id', logId);
            }
            const { data, error: insertError } = await supabase.from('weight_logs').insert(logData).select().single();
            error = insertError;
            savedData = data;
          }

          if (error) throw error;

          setWeight(savedData.weight_kg.toString());
          setComment(savedData.description || '');
          setSatietyLevelId(savedData.satiety_level_id || null);
          setLogId(savedData.id);
    setDisplayDate(logDate);
          setMode('view');
          setHasChanges(false);

          toast({
            title: '¡Peso registrado!',
            description: isAdminView ? 'El registro ha sido guardado correctamente.' : 'Tu progreso ha sido guardado correctamente.',
          });
          
          if (onLogAdded) onLogAdded(savedData);
        } catch (error) {
          console.error('Error saving weight log:', error);
          toast({
            title: 'Error al guardar',
            description: error.message || 'Ha ocurrido un error al guardar el registro.',
            variant: 'destructive',
          });
          setMode('settings');
        } finally {
          setLoading(false);
        }
      };

      const handleDelete = async () => {
        if (!logId) return;

        setLoading(true);
        try {
          const { error } = await supabase.from('weight_logs').delete().eq('id', logId);
          
          if (error) throw error;

          toast({
            title: 'Registro eliminado',
            description: 'El registro de peso ha sido eliminado correctamente.',
          });
          
          if (onLogAdded) onLogAdded(null);
          onOpenChange(false);
        } catch (error) {
          console.error('Error deleting weight log:', error);
          toast({
            title: 'Error al eliminar',
            description: error.message || 'Ha ocurrido un error al eliminar el registro.',
            variant: 'destructive',
          });
        } finally {
          setLoading(false);
        }
      };

      const selectedSatietyLevel = satietyLevels.find(level => level.id === satietyLevelId);
      const dateForDisplay = mode === 'settings' ? logDate : displayDate;

      return (
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent className="bg-[#1D2730] border-gray-700 text-white p-0 flex flex-col max-h-[90vh] w-[95vw] max-w-lg min-h-[550px]">
            <ViewModeToggle
              mode={mode}
              onModeChange={handleModeChange}
              loading={loading}
              onClose={handleClose}
              className="flex-shrink-0"
              hasChanges={hasChanges}
              showClose={false}
            />
            <div className="p-6 pt-0 space-y-4 overflow-y-auto flex-1 no-scrollbar relative">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mode}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 p-6 pt-0 flex flex-col"
                >
                  {loading ? (
                    <div className="flex justify-center items-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                    </div>
                  ) : mode === 'settings' ? (
                    <div className="space-y-4">
                      <div className="text-center">
                        <DialogTitle className="text-2xl">Registro de Peso</DialogTitle>
                        <DialogDescription className="text-center">
                          {dateForDisplay.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          {isAdminView && <span className="block text-sm text-gray-400 mt-1">Editando como administrador</span>}
                        </DialogDescription>
                      </div>
                      <div>
                        <Label htmlFor="weight" className="text-gray-300">Peso (kg)</Label>
                        <Input
                          id="weight"
                          type="number"
                          step="0.1"
                          value={weight}
                          onChange={(e) => { setWeight(e.target.value); setHasChanges(true); }}
                          className="input-field mt-1"
                          placeholder="Ej: 75.5"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="comment" className="text-gray-300">Comentario (Opcional)</Label>
                        <Textarea
                          id="comment"
                          value={comment}
                          onChange={(e) => { setComment(e.target.value); setHasChanges(true); }}
                          className="input-field mt-1"
                          placeholder="¿Cómo te sientes hoy? ¿Alguna nota sobre tu energía o sensaciones?"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Nivel de Saciedad</Label>
                        <div className="flex justify-center gap-2 sm:gap-4 mt-2">
                          {satietyLevels.map((level) => (
                            <button
                              key={level.id}
                              type="button"
                              onClick={() => { setSatietyLevelId(satietyLevelId === level.id ? null : level.id); setHasChanges(true); }}
                              className={`flex flex-col items-center p-2 sm:p-3 rounded-lg border-2 transition-all flex-1 ${
                                satietyLevelId === level.id
                                  ? 'border-violet-500 bg-violet-500/20'
                                  : 'border-gray-600 hover:border-gray-500'
                              }`}
                            >
                              <span className="text-2xl sm:text-3xl mb-1">{level.emoji}</span>
                              <span className="text-xs text-gray-300 text-center">{level.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="pt-4 mt-4 border-t border-gray-700/50">
                        <Label htmlFor="logDate" className="text-gray-400">Fecha del Registro</Label>
                        <div className="relative mt-1">
                          <DatePicker
                            id="logDate"
                            selected={logDate}
                            onChange={(date) => { setLogDate(date); setHasChanges(true); }}
                            dateFormat="dd/MM/yyyy"
                            className="input-field date-input w-full"
                            popperPlacement="top-end"
                          />
                          <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center space-y-4 p-4 bg-[#1D2730] rounded-lg">
                            <CheckCircle className="mx-auto h-12 w-12 text-violet-500" />
                            <h3 className="text-xl font-bold capitalize">
                                {format(dateForDisplay, "eeee, d 'de' MMMM. yyyy", { locale: es })}
                            </h3>
                            <p className="text-4xl font-light">{weight} <span className="text-2xl text-gray-400">kg</span></p>
                            {selectedSatietyLevel && (
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-2xl">{selectedSatietyLevel.emoji}</span>
                                <span className="text-gray-300">{selectedSatietyLevel.name}</span>
                              </div>
                            )}
                            {comment && <p className="text-gray-300 italic">"{comment}"</p>}
                        </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {logId && (
              <div className="p-6 border-t border-gray-700 flex justify-center">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                      <Trash2 className="h-5 w-5 mr-2" />
                      Eliminar Registro
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[90vw] md:w-full max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar registro de peso?</AlertDialogTitle>
                      <AlertDialogDescription className="text-gray-400">
                        Esta acción no se puede deshacer. Se eliminará permanentemente el registro de peso del {dateForDisplay.toLocaleDateString('es-ES')}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </DialogContent>
        </Dialog>
      );
    };

    export default WeightLogDialog;