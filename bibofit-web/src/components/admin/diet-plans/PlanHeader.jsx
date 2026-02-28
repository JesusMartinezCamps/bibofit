import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Users, ShieldAlert, HeartPulse, Save, User, Apple, Calendar as CalendarIcon, Tag, Edit2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import InfoBadge from '@/components/shared/InfoBadge';
import RestrictionsManager from '@/components/admin/diet-plans/RestrictionsManager';
import ClassificationManager from '@/components/admin/diet-plans/ClassificationManager';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import DatePicker from 'react-datepicker';
import AssignPlanDialog from './AssignPlanDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import ClassificationBadge from '@/components/admin/diet-plans/ClassificationBadge';

const InfoItem = ({ icon, label, children, asLink, to }) => {
  const content = (
    <div
      className={`flex items-start space-x-3 ${
        asLink ? 'hover:bg-gray-700/50 p-2 -m-2 rounded-lg transition-colors' : ''
      }`}
    >
      <div className="bg-gray-700/50 p-2 rounded-lg">{icon}</div>
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        {children}
      </div>
    </div>
  );

  if (asLink) return <Link to={to}>{content}</Link>;
  return content;
};

const ClassificationDialog = ({ template, open, onOpenChange, onUpdate }) => {
  const { toast } = useToast();
  const [values, setValues] = useState({
    objective: template.classification_objective || [],
    lifestyle: template.classification_lifestyle || [],
    nutrition_style: template.classification_nutrition_style || [],
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (axis, newValues) => {
    setValues((prev) => ({ ...prev, [axis]: newValues }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('diet_plans')
        .update({
          classification_objective: values.objective,
          classification_lifestyle: values.lifestyle,
          classification_nutrition_style: values.nutrition_style,
        })
        .eq('id', template.id);

      if (error) throw error;
      toast({ title: 'Clasificación actualizada' });
      if (onUpdate) onUpdate();
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1e23] border-gray-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Clasificación de Plantilla</DialogTitle>
          <DialogDescription>Define los ejes de clasificación para facilitar la búsqueda.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ClassificationManager selectedValues={values} onChange={handleChange} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-green-600 hover:bg-green-500 text-white"
          >
            {isSaving ? 'Guardando...' : 'Guardar Clasificación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PlanHeader = ({ plan, onUpdate, onToggleActive, readOnly = false }) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState(plan.name);
  const [isNameChanged, setIsNameChanged] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [generatedPlans, setGeneratedPlans] = useState([]);
  const debounceTimeout = useRef(null);

  const todayDateString = format(new Date(), 'yyyy-MM-dd');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  const [startDate, setStartDate] = useState(plan.start_date ? parseISO(plan.start_date) : null);
  const [endDate, setEndDate] = useState(plan.end_date ? parseISO(plan.end_date) : null);

  const [isClassificationOpen, setIsClassificationOpen] = useState(false);

  // ✅ textarea autoresize (sin librerías)
  const taRef = useRef(null);

  const resizeTA = useCallback(() => {
    const el = taRef.current;
    if (!el) return;

    // Reset height then set to scrollHeight (so it shrinks/grows correctly)
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // Cuando cambia el nombre (incluye reflow por contenido)
  useLayoutEffect(() => {
    resizeTA();
  }, [name, resizeTA]);

  // Cuando cambia el plan (cambia el name y también el wrap)
  useLayoutEffect(() => {
    // 2 frames por si el layout todavía no ha calculado fonts/width
    requestAnimationFrame(() => {
      resizeTA();
      requestAnimationFrame(resizeTA);
    });
  }, [plan?.id, resizeTA]);

  // Cuando cambia el ancho (móvil / resize / sidebar / etc.)
  useEffect(() => {
    if (!taRef.current) return;

    const el = taRef.current;

    const ro = new ResizeObserver(() => {
      resizeTA();
    });

    ro.observe(el);
    window.addEventListener('resize', resizeTA);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', resizeTA);
    };
  }, [resizeTA]);

  const sensitivities = useMemo(() => plan.sensitivities?.map((s) => s.sensitivities) || [], [plan.sensitivities]);

  const conditions = useMemo(() => plan.medical_conditions?.map((c) => c.medical_conditions) || [], [plan.medical_conditions]);

  const classifications = useMemo(
    () => [
      ...(plan.classification_objective || []).map((v) => ({ type: 'objective', value: v })),
      ...(plan.classification_lifestyle || []).map((v) => ({ type: 'lifestyle', value: v })),
      ...(plan.classification_nutrition_style || []).map((v) => ({ type: 'nutrition_style', value: v })),
    ],
    [plan]
  );

  useEffect(() => {
    setName(plan.name);
    setStartDate(plan.start_date ? parseISO(plan.start_date) : null);
    setEndDate(plan.end_date ? parseISO(plan.end_date) : null);
    setIsNameChanged(false);

    const fetchGeneratedPlans = async () => {
      if (!plan.is_template) return;

      const { data, error } = await supabase
        .from('diet_plans')
        .select('id, name, user_id, profile:user_id(full_name)')
        .eq('source_template_id', plan.id);

      if (!error) setGeneratedPlans(data?.filter((p) => p.profile) || []);
    };

    fetchGeneratedPlans();
  }, [plan]);

  const handleNameChange = (e) => {
    if (readOnly) return;
    const newName = e.target.value;
    setName(newName);
    setIsNameChanged(newName.trim() !== plan.name.trim());

    if (plan.is_template) {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

      debounceTimeout.current = setTimeout(async () => {
        if (newName.trim() === plan.name.trim()) return;
        await saveName(newName.trim());
      }, 1000);
    }
  };

  const saveName = async (newName) => {
    setIsSavingName(true);
    const { error } = await supabase.from('diet_plans').update({ name: newName }).eq('id', plan.id);

    if (error) {
      toast({
        title: 'Error',
        description: `No se pudo actualizar el nombre: ${error.message}`,
        variant: 'destructive',
      });
    } else {
      if (onUpdate) onUpdate(true);
      toast({ title: 'Éxito', description: 'Nombre del plan actualizado.' });
      setIsNameChanged(false);
    }
    setIsSavingName(false);
  };

  const handleSaveClick = () => {
    if (name.trim() && name.trim() !== plan.name.trim()) saveName(name.trim());
  };

  const handleBlur = () => {
    if (readOnly) return;
    if (plan.is_template && debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
      if (name.trim() !== plan.name.trim()) saveName(name.trim());
    }
  };

  const handleAssignSuccess = () => {
    toast({ title: 'Plan asignado', description: `La plantilla "${plan.name}" se ha asignado correctamente.` });
    setIsAssignDialogOpen(false);
    onUpdate?.(true);
  };

  const handleDateChange = async (dates) => {
    if (readOnly) return;
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);

    if (start && end && plan) {
      const { error } = await supabase
        .from('diet_plans')
        .update({
          start_date: format(start, 'yyyy-MM-dd'),
          end_date: format(end, 'yyyy-MM-dd'),
        })
        .eq('id', plan.id);

      if (error) {
        toast({ title: 'Error', description: 'No se pudo actualizar el rango de fechas.', variant: 'destructive' });
      } else {
        toast({ title: 'Éxito', description: 'Rango de fechas actualizado.' });
        onUpdate?.(true);
      }
    }
  };

  return (
    <>
      <Card className="bg-slate-900/50 border-gray-700 text-white overflow-hidden shadow-xl mb-8">
        <CardHeader className="relative">
          {/* TÍTULO Y CONTENIDO PRINCIPAL */}
          <div className="flex-grow">
            <div className="h-auto w-full flex flex-col">
              <textarea
                ref={taRef}
                value={name}
                onChange={handleNameChange}
                onBlur={handleBlur}
                rows={1}
                className="block w-full resize-none overflow-hidden text-2xl font-bold text-white bg-transparent border-0 focus:outline-none focus:bg-slate-800/50 px-2 py-2"
                placeholder="Nombre del Plan"
                disabled={isSavingName || readOnly}
              />
            </div>

            {/* Bloque de info / botones del cliente */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plan.is_template ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30 w-fit">
                      Plantilla Global
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-green-400 hover:text-green-300 hover:bg-green-900/20"
                      onClick={() => setIsClassificationOpen(true)}
                    >
                      <Edit2 className="w-3 h-3 mr-1" /> Editar Clasificación
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-gray-400 uppercase font-semibold">Clasificación:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {classifications.length > 0 ? (
                        classifications.map((tag, i) => (
                          <ClassificationBadge key={i} type={tag.type} value={tag.value} />
                        ))
                      ) : (
                        <span className="text-sm text-gray-500 italic flex items-center gap-1">
                          <Tag className="w-3 h-3" /> Sin clasificar
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <InfoItem
                    icon={<User className="w-5 h-5 text-green-400" />}
                    label="Cliente"
                    asLink
                    to={`/client-profile/${plan.user_id}`}
                  >
                    <p className="font-semibold text-white">{plan.profile?.full_name}</p>
                  </InfoItem>

                  <InfoItem
                    icon={<Apple className="w-5 h-5 text-green-400" />}
                    label="Plan de Dieta"
                    asLink
                    to={`/plan/dieta/${plan.user_id}/${todayDateString}`}
                  >
                    <p className="font-semibold text-white">Ir al Plan de Dieta</p>
                  </InfoItem>

                  <InfoItem icon={<CalendarIcon className="w-5 h-5 text-indigo-400" />} label="Rango de la Dieta">
                    {readOnly ? (
                      <p className="font-semibold text-white">
                        {startDate && endDate ? `${format(startDate, 'dd/MM/yy')} - ${format(endDate, 'dd/MM/yy')}` : 'Sin rango definido'}
                      </p>
                    ) : (
                      <DatePicker
                        selected={startDate}
                        onChange={handleDateChange}
                        startDate={startDate}
                        endDate={endDate}
                        selectsRange
                        dateFormat="dd/MM/yyyy"
                        locale={es}
                        customInput={
                          <div className="font-semibold text-white bg-gray-700/50 border border-gray-600 rounded-md px-3 py-1.5 cursor-pointer hover:bg-gray-700 transition-colors w-full text-center">
                            {startDate && endDate
                              ? `${format(startDate, 'dd/MM/yy')} - ${format(endDate, 'dd/MM/yy')}`
                              : 'Seleccionar rango'}
                          </div>
                        }
                        wrapperClassName="w-full"
                        popperClassName="z-50"
                      />
                    )}
                  </InfoItem>
                </>
              )}

              {/* Sensibilidades y patologías */}
              <div className="space-y-4">
                <InfoItem icon={<ShieldAlert className="w-5 h-5 text-orange-400" />} label="Sensibilidades del Plan">
                  {sensitivities.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {sensitivities.map((s) => (
                        <InfoBadge key={s.id} item={s} type="sensitivity" />
                      ))}
                    </div>
                  ) : (
                    <p className="font-semibold text-white">Ninguna</p>
                  )}
                </InfoItem>

                <InfoItem icon={<HeartPulse className="w-5 h-5 text-red-400" />} label="Patologías del Plan">
                  {conditions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {conditions.map((c) => (
                        <InfoBadge key={c.id} item={c} type="medical_condition" />
                      ))}
                    </div>
                  ) : (
                    <p className="font-semibold text-white">Ninguna</p>
                  )}
                </InfoItem>
              </div>
            </div>
          </div>

          {/* 🔥 ACTION BAR */}
          <div className="!mt-8 flex justify-end">
            <div className="flex items-center space-x-4 bg-gray-800/50 p-2 rounded-lg border border-gray-700">
              {plan.is_template ? (
                <Button
                  onClick={() => setIsAssignDialogOpen(true)}
                  className="bg-green-600 hover:bg-green-500 text-white"
                >
                  Asignar a cliente
                </Button>
              ) : readOnly ? (
                <Badge
                  className={`px-3 py-1 ${
                    plan.is_active ? 'bg-green-900/40 text-green-200' : 'bg-gray-700 text-gray-200'
                  }`}
                >
                  {plan.is_active ? 'Plan Activo' : 'Plan Inactivo'}
                </Badge>
              ) : (
                <>
                  <AnimatePresence>
                    {isNameChanged && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                      >
                        <Button
                          size="icon"
                          className="h-8 w-8 bg-green-600 hover:bg-green-700"
                          onClick={handleSaveClick}
                          disabled={isSavingName}
                        >
                          <Save size={16} />
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="active-plan-switch"
                      checked={plan.is_active}
                      onCheckedChange={onToggleActive}
                      className="data-[state=checked]:bg-green-500"
                    />
                    <Label htmlFor="active-plan-switch" className="text-white cursor-pointer whitespace-nowrap">
                      {plan.is_active ? 'Plan Activo' : 'Plan Inactivo'}
                    </Label>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        {plan.is_template && (
          <CardContent>
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                  <Users className="text-green-400" />
                  Usada por {generatedPlans.length} Cliente{generatedPlans.length !== 1 ? 's' : ''}
                </h3>

                {generatedPlans.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {generatedPlans.map((p) => (
                      <Link key={p.id} to={`/admin/manage-diet/${p.user_id}`}>
                        <Badge
                          variant="outline"
                          className="text-base px-3 py-1 border-green-500/40 bg-green-900/30 text-green-300 hover:bg-green-800/40 transition-colors cursor-pointer"
                        >
                          {p.profile?.full_name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Esta plantilla aún no se ha asignado a ningún cliente.</p>
                )}
              </div>

              <RestrictionsManager entityId={plan.id} entityType="diet_plans" onUpdate={onUpdate} />
            </div>
          </CardContent>
        )}
      </Card>

      <AssignPlanDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        template={plan}
        onSuccess={handleAssignSuccess}
      />

      {plan.is_template && (
        <ClassificationDialog
          template={plan}
          open={isClassificationOpen}
          onOpenChange={setIsClassificationOpen}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
};

export default PlanHeader;