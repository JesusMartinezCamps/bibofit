import React, { useState, useEffect, useCallback } from 'react';
    import { useAuth } from '@/contexts/AuthContext';
    import { supabase } from '@/lib/supabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { Label } from '@/components/ui/label';
    import { Loader2, CheckCircle, Trash2, ArrowLeft } from 'lucide-react';
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
    import { format } from 'date-fns';
    import { es } from 'date-fns/locale';
    import UnifiedDatePicker from '@/components/shared/UnifiedDatePicker';

    const WeightLogDialog = ({ open, onOpenChange, onLogAdded, initialDate, userId: propUserId, asPage = false }) => {
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

      const weightIsEmpty = mode === 'settings' && (!weight || isNaN(parseFloat(weight)));

      const formContent = (
        <>
          <ViewModeToggle
            mode={mode}
            onModeChange={handleModeChange}
            loading={loading}
            onClose={asPage ? undefined : handleClose}
            className="flex-shrink-0"
            hasChanges={hasChanges}
            showClose={asPage ? false : false}
            switchDisabled={weightIsEmpty}
            leftElement={asPage ? (
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground h-8 w-8 flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}
          />
          <div className={`p-6 pt-0 space-y-4 overflow-y-auto flex-1 no-scrollbar relative ${asPage ? '' : ''}`}>
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
                      {asPage ? (
                        <h2 className="text-2xl font-semibold">Registro de Peso</h2>
                      ) : (
                        <DialogTitle className="text-2xl">Registro de Peso</DialogTitle>
                      )}
                      {asPage ? (
                        <p className="text-sm text-muted-foreground text-center mt-1">
                          {dateForDisplay.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          {isAdminView && <span className="block mt-1">Editando como administrador</span>}
                        </p>
                      ) : (
                        <DialogDescription className="text-center">
                          {dateForDisplay.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          {isAdminView && <span className="block text-sm text-muted-foreground mt-1">Editando como administrador</span>}
                        </DialogDescription>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="weight" className="text-muted-foreground">Peso (kg)</Label>
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
                      <Label htmlFor="comment" className="text-muted-foreground">Comentario (Opcional)</Label>
                      <Textarea
                        id="comment"
                        value={comment}
                        onChange={(e) => { setComment(e.target.value); setHasChanges(true); }}
                        className="input-field mt-1"
                        placeholder="¿Cómo te sientes hoy? ¿Alguna nota sobre tu energía o sensaciones?"
                      />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Nivel de Saciedad</Label>
                      <div className="flex justify-center gap-2 sm:gap-4 mt-2">
                        {satietyLevels.map((level) => (
                          <button
                            key={level.id}
                            type="button"
                            onClick={() => { setSatietyLevelId(satietyLevelId === level.id ? null : level.id); setHasChanges(true); }}
                            className={`flex flex-col items-center p-2 sm:p-3 rounded-lg border-2 transition-all flex-1 ${
                              satietyLevelId === level.id
                                ? 'border-violet-500 bg-violet-500/20'
                                : 'border-input hover:border-gray-500'
                            }`}
                          >
                            <span className="text-2xl sm:text-3xl mb-1">{level.emoji}</span>
                            <span className="text-xs text-muted-foreground text-center">{level.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="pt-4 mt-4 border-t border-border/50">
                      <Label htmlFor="logDate" className="text-muted-foreground">Fecha del Registro</Label>
                      <div className="mt-1">
                        <UnifiedDatePicker
                          id="logDate"
                          selected={logDate}
                          onChange={(date) => { setLogDate(date); setHasChanges(true); }}
                          placeholder="Selecciona fecha"
                          maxDate={new Date()}
                          withPortal
                        />
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
                          <p className="text-4xl font-light">{weight} <span className="text-2xl text-muted-foreground">kg</span></p>
                          {selectedSatietyLevel && (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-2xl">{selectedSatietyLevel.emoji}</span>
                              <span className="text-muted-foreground">{selectedSatietyLevel.name}</span>
                            </div>
                          )}
                          {comment && <p className="text-muted-foreground italic">"{comment}"</p>}
                      </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {logId && (
            <div className="p-6 border-t border-border flex justify-center">
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
                    <AlertDialogDescription className="text-muted-foreground">
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
        </>
      );

      if (asPage) {
        return (
          <div className="flex flex-col h-full bg-[#1D2730] text-white min-h-[550px]">
            {formContent}
          </div>
        );
      }

      return (
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent className="bg-[#1D2730] border-border text-white p-0 flex flex-col max-h-[90vh] w-[95vw] max-w-lg min-h-[550px]">
            {formContent}
          </DialogContent>
        </Dialog>
      );
    };

    export default WeightLogDialog;
