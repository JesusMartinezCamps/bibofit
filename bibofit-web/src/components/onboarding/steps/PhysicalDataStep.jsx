import React, { useState, useEffect, useRef } from 'react';
import { InputWithUnit } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { getActivityLevels } from '@/lib/metabolismCalculator';
import { CircleHelp, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import UnifiedDatePicker from '@/components/shared/UnifiedDatePicker';

const booleanToSelectValue = (value) => {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return '';
};

const parseOptionalBoolean = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

const parseOptionalNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const numberValue = parseFloat(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const resolveCompositionInput = (pctValue, kgValue) => {
  if (pctValue !== null && pctValue !== undefined && pctValue !== '') {
    return { unit: 'pct', value: String(pctValue) };
  }

  if (kgValue !== null && kgValue !== undefined && kgValue !== '') {
    return { unit: 'kg', value: String(kgValue) };
  }

  return { unit: '', value: '' };
};

const INFO_CONTENT = {
  mlg: {
    title: '¿Qué es la masa libre de grasa?',
    description:
      'MLG (Masa Libre de Grasa), también llamada FFM (Fat-Free Mass), es todo lo que pesa tu cuerpo excepto la grasa: músculo, huesos, agua y órganos.'
  },
  mg: {
    title: '¿Qué es la masa grasa?',
    description:
      'MG significa Masa Grasa. Es la cantidad de grasa corporal, expresada en porcentaje (%) o en kilos (kg).'
  },
  athlete: {
    title: '¿Qué significa “ser atleta”?',
    description:
      'Para esta calculadora, “atleta” es alguien que entrena de forma estructurada y frecuente con objetivo de rendimiento o competición. Regla práctica: 4 o más días por semana, sesiones exigentes y progresión planificada. Si entrenas recreativo 1-3 días/semana, normalmente marca “No”.'
  },
  athlete_type: {
    title: 'Tipo de atleta',
    description:
      'Enfoque en físico: prioridad en composición corporal/estética. Enfoque en rendimiento: prioridad en desempeño deportivo. Si haces ambas cosas, selecciona “Ambos”, y el sistema usará un promedio de las ecuaciones disponibles de físico y rendimiento.'
  },
  methods: {
    title: 'Métodos para estimar composición corporal',
    description:
      'Puedes elegir el método con el que obtuviste tu masa libre de grasa o masa grasa. No es obligatorio. Si no lo sabes, puedes dejarlo vacío y el sistema usará el cálculo básico.'
  },
  skinfold: {
    title: 'Skinfold (plicometría)',
    description:
      'Estimación de grasa corporal mediante pliegues cutáneos con plicómetro en varios puntos del cuerpo.'
  },
  dxa: {
    title: 'DXA',
    description:
      'Absorciometría de rayos X de energía dual. Es una prueba de alta precisión para estimar grasa, masa magra y masa ósea.'
  },
  uww: {
    title: 'UWW',
    description:
      'Underwater Weighing (pesaje hidrostático). Método clásico de laboratorio para estimar composición corporal.'
  },
  bia: {
    title: 'BIA',
    description:
      'Bioimpedancia eléctrica. Estima composición corporal a partir de la resistencia del cuerpo al paso de una corriente eléctrica muy baja.'
  }
};

const InfoIconButton = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Más información sobre ${label}`}
    className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
  >
    <CircleHelp className="h-4 w-4" />
  </button>
);

const PhysicalDataStep = ({ onNext, isLoading }) => {
  const { user } = useAuth();
  const scrollContainerRef = useRef(null);
  const advancedSectionRef = useRef(null);

  const [infoModalKey, setInfoModalKey] = useState(null);
  const initialFfmInput = resolveCompositionInput(user?.ffm_pct, user?.ffm_kg);
  const initialFmInput = resolveCompositionInput(user?.fm_pct, user?.fm_kg);

  const [formData, setFormData] = useState({
    birth_date: user?.birth_date || '',
    sex: user?.sex || '',
    height_cm: user?.height_cm || '',
    current_weight_kg: user?.current_weight_kg || '',
    activity_level_id: user?.activity_level_id ? String(user.activity_level_id) : '',

    knows_ffm: booleanToSelectValue(user?.knows_ffm),
    ffm_method: user?.ffm_method || '',
    is_athlete: booleanToSelectValue(user?.is_athlete),
    athlete_type: user?.athlete_type || '',
    ffm_unit: initialFfmInput.unit,
    ffm_value: initialFfmInput.value,
    fm_unit: initialFmInput.unit,
    fm_value: initialFmInput.value
  });

  const [activityLevels, setActivityLevels] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSmallMobileViewport, setIsSmallMobileViewport] = useState(false);

  const [showAdvancedFields, setShowAdvancedFields] = useState(() => {
    return Boolean(
      user?.knows_ffm !== null && user?.knows_ffm !== undefined
      || user?.ffm_method
      || user?.is_athlete !== null && user?.is_athlete !== undefined
      || user?.athlete_type
      || user?.ffm_pct !== null && user?.ffm_pct !== undefined
      || user?.fm_pct !== null && user?.fm_pct !== undefined
      || user?.ffm_kg !== null && user?.ffm_kg !== undefined
      || user?.fm_kg !== null && user?.fm_kg !== undefined
    );
  });

  const showBodyCompositionSection = formData.knows_ffm === 'true';

  const showAthleteTypeSection = Boolean(formData.is_athlete === 'true' || formData.athlete_type);

  useEffect(() => {
    getActivityLevels().then(setActivityLevels);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 390px)');
    const updateViewportState = (event) => setIsSmallMobileViewport(event.matches);
    setIsSmallMobileViewport(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateViewportState);
      return () => mediaQuery.removeEventListener('change', updateViewportState);
    }

    mediaQuery.addListener(updateViewportState);
    return () => mediaQuery.removeListener(updateViewportState);
  }, []);

  useEffect(() => {
    if (formData.knows_ffm !== 'false') return;

    setFormData((prev) => {
      const hasBodyCompositionValues = Boolean(
        prev.ffm_method
        || prev.ffm_unit
        || prev.ffm_value
        || prev.fm_unit
        || prev.fm_value
      );

      if (!hasBodyCompositionValues) return prev;

      return {
        ...prev,
        ffm_method: '',
        ffm_unit: '',
        ffm_value: '',
        fm_unit: '',
        fm_value: ''
      };
    });
    setErrors((prev) => ({ ...prev, ffm_value: undefined, fm_value: undefined }));
  }, [formData.knows_ffm]);

  useEffect(() => {
    if (!showAdvancedFields) return;

    const timeoutId = window.setTimeout(() => {
      const container = scrollContainerRef.current;
      const target = advancedSectionRef.current;

      if (container && target) {
        const containerTop = container.getBoundingClientRect().top;
        const targetTop = target.getBoundingClientRect().top;
        const scrollOffset = targetTop - containerTop;
        if (scrollOffset > 0) {
          container.scrollBy({ top: scrollOffset, behavior: 'smooth' });
        }
      }
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [showAdvancedFields, showBodyCompositionSection, showAthleteTypeSection]);

  const validate = () => {
    const newErrors = {};

    if (!formData.birth_date) newErrors.birth_date = 'Fecha obligatoria';
    if (!formData.sex) newErrors.sex = 'Selecciona tu sexo';
    if (!formData.height_cm || Number(formData.height_cm) <= 0) newErrors.height_cm = 'Altura inválida';
    if (!formData.current_weight_kg || Number(formData.current_weight_kg) <= 0) newErrors.current_weight_kg = 'Peso inválido';
    if (!formData.activity_level_id) newErrors.activity_level_id = 'Nivel de actividad obligatorio';

    const ffmValue = parseOptionalNumber(formData.ffm_value);
    const fmValue = parseOptionalNumber(formData.fm_value);

    if (formData.ffm_value && !formData.ffm_unit) {
      newErrors.ffm_value = 'Selecciona si el valor es en % o en kg';
    }

    if (formData.fm_value && !formData.fm_unit) {
      newErrors.fm_value = 'Selecciona si el valor es en % o en kg';
    }

    if (formData.ffm_value && formData.ffm_unit === 'pct' && (ffmValue === null || ffmValue < 0 || ffmValue > 100)) {
      newErrors.ffm_value = 'La masa libre de grasa en % debe estar entre 0 y 100';
    }

    if (formData.ffm_value && formData.ffm_unit === 'kg' && (ffmValue === null || ffmValue <= 0)) {
      newErrors.ffm_value = 'La masa libre de grasa en kg debe ser mayor que 0';
    }

    if (formData.fm_value && formData.fm_unit === 'pct' && (fmValue === null || fmValue < 0 || fmValue > 100)) {
      newErrors.fm_value = 'La masa grasa en % debe estar entre 0 y 100';
    }

    if (formData.fm_value && formData.fm_unit === 'kg' && (fmValue === null || fmValue <= 0)) {
      newErrors.fm_value = 'La masa grasa en kg debe ser mayor que 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) return;

    const ffmValue = parseOptionalNumber(formData.ffm_value);
    const fmValue = parseOptionalNumber(formData.fm_value);

    const ffmPct = formData.ffm_unit === 'pct' ? ffmValue : null;
    const ffmKg = formData.ffm_unit === 'kg' ? ffmValue : null;
    const fmPct = formData.fm_unit === 'pct' ? fmValue : null;
    const fmKg = formData.fm_unit === 'kg' ? fmValue : null;

    const hasAnyBodyCompositionData = [ffmPct, fmPct, ffmKg, fmKg].some((value) => value !== null);

    const knowsFfmExplicit = parseOptionalBoolean(formData.knows_ffm);
    const isAthleteExplicit = parseOptionalBoolean(formData.is_athlete);

    const knowsFfmResolved = knowsFfmExplicit ?? (hasAnyBodyCompositionData ? true : null);
    const isAthleteResolved = isAthleteExplicit ?? (formData.athlete_type ? true : null);

    const payload = {
      birth_date: formData.birth_date,
      sex: formData.sex,
      height_cm: parseFloat(formData.height_cm),
      current_weight_kg: parseFloat(formData.current_weight_kg),
      activity_level_id: parseInt(formData.activity_level_id, 10),

      knows_ffm: knowsFfmResolved,
      ffm_method: knowsFfmResolved ? (formData.ffm_method || null) : null,
      is_athlete: isAthleteResolved,
      athlete_type: isAthleteResolved ? (formData.athlete_type || null) : null,
      ffm_pct: ffmPct,
      fm_pct: fmPct,
      ffm_kg: ffmKg,
      fm_kg: fmKg
    };

    onNext(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div ref={scrollContainerRef} className="flex-1 space-y-6 overflow-y-auto pr-6 md:pr-0">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sex" className="text-muted-foreground">Sexo</Label>
            <Select
              value={formData.sex}
              onValueChange={(v) => {
                setFormData((prev) => ({ ...prev, sex: v }));
                setErrors((prev) => ({ ...prev, sex: undefined }));
              }}
            >
              <SelectTrigger id="sex" type="button" className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Hombre">Hombre</SelectItem>
                <SelectItem value="Mujer">Mujer</SelectItem>
              </SelectContent>
            </Select>
            {errors.sex && <p className="text-red-400 text-xs">{errors.sex}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="birth_date" className="text-muted-foreground">Nacimiento</Label>
            <div className="relative">
              <UnifiedDatePicker
                id="birth_date"
                selected={formData.birth_date ? new Date(`${formData.birth_date}T00:00:00`) : null}
                onChange={(date) => {
                  setFormData((prev) => ({
                    ...prev,
                    birth_date: date ? format(date, 'yyyy-MM-dd') : ''
                  }));
                  setErrors((prev) => ({ ...prev, birth_date: undefined }));
                }}
                placeholder="Selecciona tu fecha"
                maxDate={new Date()}
                minYear={1920}
                maxYear={new Date().getFullYear()}
                withPortal={isSmallMobileViewport}
              />
            </div>
            {errors.birth_date && <p className="text-red-400 text-xs">{errors.birth_date}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="height" className="text-muted-foreground">Altura</Label>
            <InputWithUnit
              id="height"
              type="number"
              unit="cm"
              value={formData.height_cm}
              onChange={(e) => {
                setFormData({ ...formData, height_cm: e.target.value });
                setErrors((prev) => ({ ...prev, height_cm: undefined }));
              }}
              className="pl-12 bf-form-control"
              placeholder="175"
            />
            {errors.height_cm && <p className="text-red-400 text-xs">{errors.height_cm}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight" className="text-muted-foreground">Peso</Label>
            <InputWithUnit
              id="weight"
              type="number"
              unit="kg"
              step="0.1"
              value={formData.current_weight_kg}
              onChange={(e) => {
                setFormData({ ...formData, current_weight_kg: e.target.value });
                setErrors((prev) => ({ ...prev, current_weight_kg: undefined }));
              }}
              className="pl-12 bf-form-control"
              placeholder="70.5"
            />
            {errors.current_weight_kg && <p className="text-red-400 text-xs">{errors.current_weight_kg}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="activity" className="text-muted-foreground">Nivel de Actividad</Label>
          <Select
            value={String(formData.activity_level_id)}
            onValueChange={(v) => {
              setFormData((prev) => ({ ...prev, activity_level_id: v }));
              setErrors((prev) => ({ ...prev, activity_level_id: undefined }));
            }}
          >
            <SelectTrigger id="activity" type="button" className="h-auto py-3 w-full">
              <SelectValue placeholder="Selecciona tu actividad" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {activityLevels.map((level) => (
                <SelectItem key={level.id} value={String(level.id)} className="py-2">
                  <span className="font-medium block text-sm">{level.name}</span>
                  <span className="text-xs text-muted-foreground block truncate max-w-[280px] mt-0.5">{level.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.activity_level_id && <p className="text-red-400 text-xs">{errors.activity_level_id}</p>}
        </div>

        <div ref={advancedSectionRef} className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Datos avanzados (opcionales)</p>
              <p className="text-xs text-muted-foreground">
                Si conoces tu composición corporal o perfil deportivo, afinaremos la ecuación del GER.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => setShowAdvancedFields((prev) => !prev)}
            >
              {showAdvancedFields ? 'Ocultar' : 'Añadir'}
            </Button>
          </div>

          {showAdvancedFields && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="knows_ffm" className="text-muted-foreground">¿Conoces tu masa libre de grasa?</Label>
                  <InfoIconButton onClick={() => setInfoModalKey('mlg')} label="masa libre de grasa" />
                </div>
                <Select
                  value={formData.knows_ffm}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, knows_ffm: v }))}
                >
                  <SelectTrigger id="knows_ffm" type="button" className="w-full">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Sí</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {showBodyCompositionSection && (
                <>
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Puedes introducir solo un dato o varios. La calculadora usa lo que tengas disponible y estima el resto automáticamente.
                    </p>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Label htmlFor="ffm_value" className="text-muted-foreground">Masa libre de grasa</Label>
                        <InfoIconButton onClick={() => setInfoModalKey('mlg')} label="masa libre de grasa" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[210px_1fr] gap-3">
                        <div className="rounded-md border border-border bg-background px-3 py-2 space-y-2">
                          <p className="text-xs text-muted-foreground">Unidad</p>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={formData.ffm_unit === 'pct'}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  ffm_unit: checked ? 'pct' : prev.ffm_unit === 'pct' ? '' : prev.ffm_unit
                                }));
                                setErrors((prev) => ({ ...prev, ffm_value: undefined }));
                              }}
                            />
                            %
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={formData.ffm_unit === 'kg'}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  ffm_unit: checked ? 'kg' : prev.ffm_unit === 'kg' ? '' : prev.ffm_unit
                                }));
                                setErrors((prev) => ({ ...prev, ffm_value: undefined }));
                              }}
                            />
                            kg
                          </label>
                        </div>
                        <InputWithUnit
                          id="ffm_value"
                          type="number"
                          unit={formData.ffm_unit === 'pct' ? '%' : formData.ffm_unit === 'kg' ? 'kg' : ''}
                          step="0.1"
                          value={formData.ffm_value}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, ffm_value: e.target.value }));
                            setErrors((prev) => ({ ...prev, ffm_value: undefined }));
                          }}
                          className="pl-12 bf-form-control"
                          placeholder="Valor opcional"
                        />
                      </div>
                      {errors.ffm_value && <p className="text-red-400 text-xs">{errors.ffm_value}</p>}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Label htmlFor="fm_value" className="text-muted-foreground">Masa grasa</Label>
                        <InfoIconButton onClick={() => setInfoModalKey('mg')} label="masa grasa" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[210px_1fr] gap-3">
                        <div className="rounded-md border border-border bg-background px-3 py-2 space-y-2">
                          <p className="text-xs text-muted-foreground">Unidad</p>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={formData.fm_unit === 'pct'}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  fm_unit: checked ? 'pct' : prev.fm_unit === 'pct' ? '' : prev.fm_unit
                                }));
                                setErrors((prev) => ({ ...prev, fm_value: undefined }));
                              }}
                            />
                            %
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={formData.fm_unit === 'kg'}
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  fm_unit: checked ? 'kg' : prev.fm_unit === 'kg' ? '' : prev.fm_unit
                                }));
                                setErrors((prev) => ({ ...prev, fm_value: undefined }));
                              }}
                            />
                            kg
                          </label>
                        </div>
                        <InputWithUnit
                          id="fm_value"
                          type="number"
                          unit={formData.fm_unit === 'pct' ? '%' : formData.fm_unit === 'kg' ? 'kg' : ''}
                          step="0.1"
                          value={formData.fm_value}
                          onChange={(e) => {
                            setFormData((prev) => ({ ...prev, fm_value: e.target.value }));
                            setErrors((prev) => ({ ...prev, fm_value: undefined }));
                          }}
                          className="pl-12 bf-form-control"
                          placeholder="Valor opcional"
                        />
                      </div>
                      {errors.fm_value && <p className="text-red-400 text-xs">{errors.fm_value}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="ffm_method" className="text-muted-foreground">Método de medición (opcional)</Label>
                      <InfoIconButton onClick={() => setInfoModalKey('methods')} label="métodos de composición corporal" />
                    </div>
                    <Select
                      value={formData.ffm_method}
                      onValueChange={(v) => setFormData((prev) => ({ ...prev, ffm_method: v }))}
                    >
                      <SelectTrigger id="ffm_method" type="button" className="w-full">
                        <SelectValue placeholder="Selecciona cómo se midió tu composición corporal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Skinfold">Pliegues cutáneos (Skinfold)</SelectItem>
                        <SelectItem value="DXA">Absorciometría por rayos X (DXA)</SelectItem>
                        <SelectItem value="UWW">Pesaje hidrostático (UWW)</SelectItem>
                        <SelectItem value="BIA">Bioimpedancia (BIA)</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button type="button" variant="outline" className="h-7 px-2 text-xs" onClick={() => setInfoModalKey('skinfold')}>
                        Pliegues cutáneos <CircleHelp className="h-3.5 w-3.5 ml-1" />
                      </Button>
                      <Button type="button" variant="outline" className="h-7 px-2 text-xs" onClick={() => setInfoModalKey('dxa')}>
                        Absorciometría (DXA) <CircleHelp className="h-3.5 w-3.5 ml-1" />
                      </Button>
                      <Button type="button" variant="outline" className="h-7 px-2 text-xs" onClick={() => setInfoModalKey('uww')}>
                        Pesaje hidrostático <CircleHelp className="h-3.5 w-3.5 ml-1" />
                      </Button>
                      <Button type="button" variant="outline" className="h-7 px-2 text-xs" onClick={() => setInfoModalKey('bia')}>
                        Bioimpedancia (BIA) <CircleHelp className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="is_athlete" className="text-muted-foreground">¿Eres atleta?</Label>
                  <InfoIconButton onClick={() => setInfoModalKey('athlete')} label="ser atleta" />
                </div>
                <Select
                  value={formData.is_athlete}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, is_athlete: v }))}
                >
                  <SelectTrigger id="is_athlete" type="button" className="w-full">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Sí</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {showAthleteTypeSection && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="athlete_type" className="text-muted-foreground">Enfoque principal de entrenamiento (opcional)</Label>
                    <InfoIconButton onClick={() => setInfoModalKey('athlete_type')} label="tipo de atleta" />
                  </div>
                  <Select
                    value={formData.athlete_type}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, athlete_type: v }))}
                  >
                    <SelectTrigger id="athlete_type" type="button" className="w-full">
                      <SelectValue placeholder="Físico, rendimiento o ambos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Physique">Enfoque en físico</SelectItem>
                      <SelectItem value="Sport">Enfoque en rendimiento</SelectItem>
                      <SelectItem value="Both">Ambos (físico y rendimiento)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Si eliges “Ambos”, el sistema promedia ecuaciones de físico y rendimiento cuando hay datos suficientes.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(infoModalKey)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setInfoModalKey(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{infoModalKey ? INFO_CONTENT[infoModalKey]?.title : ''}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {infoModalKey ? INFO_CONTENT[infoModalKey]?.description : ''}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <div className="pt-6 mt-auto shrink-0 pr-6 md:pr-0">
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Guardando...</>
          ) : 'Siguiente'}
        </Button>
      </div>
    </form>
  );
};

export default PhysicalDataStep;
