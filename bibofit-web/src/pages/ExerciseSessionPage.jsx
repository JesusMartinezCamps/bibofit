import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import {
  ArrowLeft, Info, Flame, Shuffle, FileText,
  Search, X, Check, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, ChevronRight, TrendingUp,
  Dumbbell, Clock, SkipForward, Timer, Pause, Play,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import RirScaleSelector from '@/components/training/shared/RirScaleSelector'
import { cn } from '@/lib/utils'
import * as timingService from '@/lib/exerciseTimingService'
import { getWorkoutSessionPayload } from '@/lib/training/workoutSessionService'

// Color de entrenamiento de la app
const T = '#F44C40'

// ─── Fallback Mock (demo sin datos reales) ────────────────────────────────────

const MOCK_EXERCISE = {
  name: 'Conventional Deadlift',
  musclesMain: ['Glúteos', 'Isquiotibiales', 'Erector espinal'],
  musclesSecondary: ['Trapecio', 'Core', 'Antebrazos'],
  equipment: 'Barra olímpica',
  technique: [
    'Pies a la anchura de caderas, barra sobre el mediopié.',
    'Agarre pronado o mixto, manos justo fuera de las piernas.',
    'Caderas atrás, pecho arriba — espalda neutra antes de iniciar.',
    'Empuja el suelo con los pies; no tires de la barra con la espalda.',
    'La barra roza las espinillas durante todo el ascenso.',
    'Bloquea caderas y rodillas al mismo tiempo al llegar arriba.',
  ],
  commonErrors: [
    { error: 'Redondear la espalda baja', fix: 'Activa el core antes de jalar; aprieta glúteos al inicio del movimiento' },
    { error: 'Caderas suben antes que el torso', fix: 'Piensa en "empujar el suelo", no en "levantar la barra"' },
    { error: 'Barra separada del cuerpo', fix: 'La barra debe rozar las espinillas en todo el recorrido ascendente' },
    { error: 'Hiperextensión al bloquear', fix: 'Bloqueo neutro: caderas al frente, sin arquear la lumbar al final' },
  ],
  mediaPhases: ['Inicio', 'Descenso', 'Pos. baja', 'Ascenso', 'Bloqueo'],
  targetSets: 4,
  targetRepsMin: 4,
  targetRepsMax: 6,
  restSeconds: 120,
  prevSets: {
    1: { weight: 175, reps: 5, rir: 0 },
    2: { weight: 175, reps: 4, rir: 0 },
    3: { weight: 175, reps: 4, rir: 1 },
    4: { weight: 175, reps: 3, rir: 2 },
  },
  rirAlert: {
    title: 'Intensidad muy alta 2 semanas seguidas',
    action: 'Considera bajar el peso o hacer una rep menos por serie',
  },
}

const MOCK_VARIANTS = [
  { id: 1, name: 'Romanian Deadlift',  muscles: 'Isquios · Glúteos',    equipment: 'Barra',      similarity: 92 },
  { id: 2, name: 'Sumo Deadlift',      muscles: 'Glúteos · Aductores',  equipment: 'Barra',      similarity: 88 },
  { id: 3, name: 'Trap Bar Deadlift',  muscles: 'Cuádriceps · Glúteos', equipment: 'Trap bar',   similarity: 82 },
  { id: 4, name: 'Single Leg RDL',     muscles: 'Isquios · Glúteos',    equipment: 'Mancuernas', similarity: 75 },
  { id: 5, name: 'Good Mornings',      muscles: 'Erector · Isquios',    equipment: 'Barra',      similarity: 70 },
  { id: 6, name: 'Stiff Leg Deadlift', muscles: 'Isquios',              equipment: 'Barra',      similarity: 65 },
]

/** Genera series de calentamiento automáticas a partir del peso de trabajo */
function generateWarmupSets(workWeight) {
  if (!workWeight || workWeight <= 20) return []
  const pcts = [
    { pct: 0.11, reps: 8, note: 'Barra sola · activación neural' },
    { pct: 0.35, reps: 5, note: '' },
    { pct: 0.57, reps: 3, note: '' },
    { pct: 0.80, reps: 2, note: '' },
  ]
  return pcts
    .map((p, i) => {
      const w = Math.round((workWeight * p.pct) / 5) * 5  // redondear a 5 kg
      return {
        id: `w${i + 1}`,
        label: `W${i + 1}`,
        weight: Math.max(20, w),
        reps: p.reps,
        pct: `${Math.round(p.pct * 100)}%`,
        note: p.note,
      }
    })
    .filter(s => s.weight < workWeight)  // no incluir si supera el peso de trabajo
}

/** Genera las filas de series a partir de los datos del ejercicio */
function buildInitialSets(exercise) {
  const n = exercise.targetSets || 4
  const prevS = exercise.prevSets || {}
  const currS = exercise.currentSets || {}
  const prevW1 = prevS[1]?.weight || null
  return Array.from({ length: n }, (_, i) => {
    const no = i + 1
    const prev = prevS[no]
    const curr = currS[no]
    return {
      id: `s${no}`,
      no,
      dbSetId: curr?.id ?? null,
      targetMin: exercise.targetRepsMin || curr?.target_reps_min || 8,
      targetMax: exercise.targetRepsMax || curr?.target_reps_max || 12,
      targetWeight: prev?.weight ?? prevW1 ?? 0,
      prevWeight: prev?.weight ?? null,
      prevReps: prev?.reps ?? null,
      prevRir: prev?.rir ?? null,
      currentWeight: curr?.weight ?? null,
      currentReps: curr?.reps ?? null,
      currentRir: curr?.rir ?? null,
      startedAt: curr?.started_at ? new Date(curr.started_at) : null,
      completedAt: curr?.completed_at ? new Date(curr.completed_at) : null,
    }
  })
}

const REST_MIN_SECONDS = 15
const REST_MAX_SECONDS = 300
const REST_STEP_SECONDS = 5
const REST_DEFAULT_SECONDS = 120

// ─── Utils ────────────────────────────────────────────────────────────────────

/** Formatea segundos como MM:SS */
function fmt(secs) {
  const m = Math.floor(Math.abs(secs) / 60).toString().padStart(2, '0')
  const s = (Math.abs(secs) % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function parseMetricValue(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toNullableInt(value) {
  const parsed = parseMetricValue(value)
  if (parsed === null) return null
  return Math.round(parsed)
}

function normalizeRestSeconds(value, fallback = REST_DEFAULT_SECONDS) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  const clamped = Math.min(REST_MAX_SECONDS, Math.max(REST_MIN_SECONDS, parsed))
  return Math.round(clamped / REST_STEP_SECONDS) * REST_STEP_SECONDS
}

function getDeltaStyles(diff) {
  if (diff === null) return 'text-muted-foreground'
  if (diff < 0) return 'text-amber-600 dark:text-amber-400'
  if (diff === 0) return 'text-emerald-600 dark:text-emerald-400'
  return 'text-primary'
}

function getDeltaText(diff) {
  if (diff === null) return '—'
  if (diff === 0) return 'Igual'
  return diff > 0 ? `+${diff}` : `${diff}`
}

/**
 * RIR Logic:
 * - 0      → Fallo. Reduce intensidad.
 * - 1–3    → Zona óptima.
 * - 4+     → Demasiado fácil. Aumentar.
 */
function getRirZone(rir) {
  if (rir === null || rir === undefined) return null
  if (rir === 0) return {
    label: 'Fallo',
    chip: 'bg-amber-500/15 text-amber-600 border-amber-400/30 dark:text-amber-400',
    icon: AlertTriangle,
    tip: 'Reduce peso o reps la próxima sesión',
    tipColor: 'text-amber-600 dark:text-amber-400',
  }
  if (rir <= 3) return {
    label: `RIR ${rir}`,
    chip: 'bg-primary/10 text-primary border-primary/25',
    icon: CheckCircle2,
    tip: 'Zona óptima — mantén esta intensidad',
    tipColor: 'text-primary',
  }
  return {
    label: `RIR ${rir}`,
    chip: 'bg-blue-500/10 text-blue-600 border-blue-400/30 dark:text-blue-400',
    icon: TrendingUp,
    tip: 'Intensidad baja — aumenta peso o reps',
    tipColor: 'text-blue-600 dark:text-blue-400',
  }
}

function SectionDivider({ label, count, tone = 'default' }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 h-px bg-border" />
      <span
        className={cn(
          'text-[10px] font-semibold uppercase tracking-widest',
          tone === 'warmup' ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'
        )}
      >
        {label}
      </span>
      {count !== undefined && (
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground font-mono">
          {count}
        </span>
      )}
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────

function BottomSheet({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-card border-t border-border max-h-[88vh]"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
              <h3 className="font-semibold text-foreground text-base">{title}</h3>
              <button onClick={onClose} className="p-1.5 -mr-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 overscroll-contain">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Media Strip ──────────────────────────────────────────────────────────────

function MediaStrip({ phases }) {
  return (
    <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar py-1">
      {phases.map((phase, i) => (
        <div key={i} className="flex-shrink-0 w-[68px] h-[68px] rounded-xl bg-muted flex flex-col items-center justify-center gap-1.5 border border-border">
          <Dumbbell className="w-5 h-5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-medium text-center leading-tight px-1">{phase}</span>
        </div>
      ))}
      <button className="flex-shrink-0 w-[68px] h-[68px] rounded-xl border border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border/60 transition-colors">
        <span className="text-2xl leading-none mb-0.5">+</span>
      </button>
    </div>
  )
}

// ─── Rest Timer ───────────────────────────────────────────────────────────────


// ─── Session Summary Modal ────────────────────────────────────────────────────

function SummaryModal({ open, summary, onClose, exerciseName, totalSets, nextExerciseName }) {
  if (!summary) return null

  const rows = [
    { label: 'Duración total',    value: timingService.formatDuration(summary.totalSec),   icon: Clock, highlight: false },
    { label: 'Calentamiento',     value: timingService.formatDuration(summary.warmupSec),  icon: Flame, highlight: false },
    { label: 'Trabajo real',      value: timingService.formatDuration(summary.workSec),    icon: Timer, highlight: true  },
    { label: 'Series completadas',value: `${summary.setsCompleted}/${totalSets}`, icon: CheckCircle2, highlight: false },
    { label: 'Descanso promedio', value: summary.avgRest != null ? timingService.formatDuration(summary.avgRest) : '—', icon: SkipForward, highlight: false },
    { label: 'Descanso máximo',   value: summary.maxRest != null ? timingService.formatDuration(summary.maxRest) : '—', icon: SkipForward, highlight: false },
  ]

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-foreground/50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          />
          <motion.div
            className="fixed inset-x-4 bottom-6 z-50 rounded-2xl bg-card border border-border shadow-xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-border">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">Ejercicio completado</h2>
              </div>
              <p className="text-sm text-muted-foreground">{exerciseName}</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-px bg-border">
              {rows.map(({ label, value, icon: Icon, highlight }) => (
                <div
                  key={label}
                  className={cn("px-4 py-3 bg-card", highlight && "bg-primary/5")}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon className={cn("w-3 h-3", highlight ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
                  </div>
                  <p className={cn("text-lg font-bold tabular-nums", highlight ? "text-primary" : "text-foreground")}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="p-4">
              <Button onClick={onClose} className="w-full h-12 gap-2 bg-primary hover:bg-primary/90">
                {nextExerciseName ? (
                  <>
                    <ChevronRight className="w-4 h-4" />
                    Siguiente: {nextExerciseName}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Finalizar entreno
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Working Set Row ──────────────────────────────────────────────────────────

function WorkingSetRow({ set, setData, isActive, currentSetSecs, onSelect, onUpdate, onComplete }) {
  const d = setData[set.id] || { weight: '', reps: '', rir: null, completed: false }
  const zone = d.rir !== null && d.rir !== undefined ? getRirZone(d.rir) : null
  const prevZone = set.prevRir !== null ? getRirZone(set.prevRir) : null
  const typedWeight = parseMetricValue(d.weight)
  const typedReps = parseMetricValue(d.reps)
  const weightDiff = typedWeight !== null && set.prevWeight !== null ? typedWeight - set.prevWeight : null
  const repsDiff = typedReps !== null && set.prevReps !== null ? typedReps - set.prevReps : null
  const effectiveWeight = typedWeight ?? set.prevWeight ?? set.targetWeight
  const effectiveReps = typedReps ?? set.prevReps
  const resolvedWeight = d.weight || (set.prevWeight != null ? String(set.prevWeight) : String(set.targetWeight))
  const resolvedReps = d.reps || (set.prevReps != null ? String(set.prevReps) : '')
  const canComplete = Boolean(resolvedWeight && resolvedReps)

  return (
    <motion.div
      layout
      className={cn(
        "rounded-xl border transition-all duration-200 overflow-hidden",
        d.completed
          ? 'bg-primary/5 border-primary/20 opacity-70'
          : isActive
          ? 'bg-card border-[#F44C40]/35 shadow-sm'
          : 'bg-card border-border hover:border-border/60'
      )}
    >
      <button onClick={onSelect} disabled={d.completed} className="w-full p-3.5 text-left">
        <div className="flex items-center justify-between gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors",
            d.completed ? 'bg-primary/15 text-primary'
              : isActive ? 'bg-[#F44C40]/15 text-[#F44C40]'
              : 'bg-muted text-muted-foreground'
          )}>
            {d.completed ? <Check className="w-3.5 h-3.5" /> : set.no}
          </div>

          {isActive && !d.completed && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
              <Timer className="w-3 h-3" />
              <span className="font-mono">{fmt(currentSetSecs)}</span>
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border bg-muted/35 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Objetivo</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{set.targetMin}–{set.targetMax} reps</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/35 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Anterior</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {set.prevWeight ?? '—'} kg × {set.prevReps ?? '—'}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Actual</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {effectiveWeight ?? '—'} kg × {effectiveReps ?? '—'}
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className={cn('text-[10px] font-semibold', getDeltaStyles(weightDiff))}>
            Peso: {getDeltaText(weightDiff)}
          </span>
          <span className={cn('text-[10px] font-semibold', getDeltaStyles(repsDiff))}>
            Reps: {getDeltaText(repsDiff)}
          </span>
          {prevZone && (
            <span className={cn('text-[10px] font-semibold', prevZone.tipColor)}>· Prev {prevZone.label}</span>
          )}
          {zone && (
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold', zone.chip)}>
              {zone.label}
            </span>
          )}
        </div>
      </button>

      <AnimatePresence>
        {isActive && !d.completed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
          >
            <div className="px-3.5 pb-4 space-y-4 border-t border-border pt-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-muted-foreground font-semibold mb-1.5 uppercase tracking-wide">Peso (kg)</label>
                  <input
                    type="number" inputMode="decimal"
                    value={d.weight}
                    onChange={e => onUpdate(set.id, { ...d, weight: e.target.value })}
                    placeholder={String(set.prevWeight ?? set.targetWeight)}
                    className="w-full h-12 rounded-xl bg-background border border-input text-foreground font-bold text-center text-base focus:outline-none focus:border-[#F44C40]/60 focus:ring-1 focus:ring-[#F44C40]/20 transition-all placeholder-muted-foreground/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <p className={cn('text-[10px] text-center mt-1', getDeltaStyles(weightDiff))}>
                    ant: {set.prevWeight ?? '—'} kg · {getDeltaText(weightDiff)}
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] text-muted-foreground font-semibold mb-1.5 uppercase tracking-wide">Reps</label>
                  <input
                    type="number" inputMode="numeric"
                    value={d.reps}
                    onChange={e => onUpdate(set.id, { ...d, reps: e.target.value })}
                    placeholder={set.prevReps != null ? String(set.prevReps) : `${set.targetMin}–${set.targetMax}`}
                    className="w-full h-12 rounded-xl bg-background border border-input text-foreground font-bold text-center text-base focus:outline-none focus:border-[#F44C40]/60 focus:ring-1 focus:ring-[#F44C40]/20 transition-all placeholder-muted-foreground/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <p className={cn('text-[10px] text-center mt-1', getDeltaStyles(repsDiff))}>
                    ant: {set.prevReps ?? '—'} reps · {getDeltaText(repsDiff)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">RIR real</p>
                <RirScaleSelector
                  compact
                  toggleToNull
                  className="justify-start"
                  value={d.rir}
                  onChange={v => onUpdate(set.id, { ...d, rir: v })}
                />
              </div>

              {zone && (
                <div className={cn("flex items-center gap-1.5 text-[11px]", zone.tipColor)}>
                  <zone.icon className="w-3 h-3 flex-shrink-0" />
                  <span>{zone.tip}</span>
                </div>
              )}

              <Button
                variant="training"
                onClick={() => {
                  onUpdate(set.id, { ...d, weight: resolvedWeight, reps: resolvedReps })
                  onComplete(set.id)
                }}
                disabled={!canComplete}
                className="w-full h-11 gap-2"
              >
                <Check className="w-4 h-4" />
                Serie completada
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Info Sheet ───────────────────────────────────────────────────────────────

function InfoSheet({ open, onClose, exercise }) {
  const [tab, setTab] = useState('technique')
  const tabs = [
    { id: 'technique', label: 'Técnica' },
    { id: 'muscles',   label: 'Músculos' },
    { id: 'errors',    label: 'Errores' },
  ]
  return (
    <BottomSheet open={open} onClose={onClose} title={exercise.name}>
      <div className="flex gap-1 p-4 pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-colors",
              tab === t.id ? 'bg-[#F44C40]/10 text-[#F44C40]' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="px-4 pb-8 space-y-3">
        {tab === 'technique' && (
          <ol className="space-y-3 pt-1">
            {(exercise.technique || []).map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{ background: `${T}20`, color: T }}>{i + 1}</span>
                <p className="text-sm text-foreground leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        )}
        {tab === 'muscles' && (
          <div className="space-y-4 pt-1">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Primarios</p>
              <div className="flex flex-wrap gap-2">
                {(exercise.musclesMain || []).map(m => (
                  <span key={m} className="px-3 py-1.5 rounded-lg text-sm font-medium border"
                    style={{ background: `${T}12`, color: T, borderColor: `${T}25` }}>{m}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Secundarios</p>
              <div className="flex flex-wrap gap-2">
                {(exercise.musclesSecondary || []).map(m => (
                  <span key={m} className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm border border-border">{m}</span>
                ))}
              </div>
            </div>
            <div className="h-44 rounded-xl bg-muted border border-border flex items-center justify-center">
              <div className="text-center">
                <Dumbbell className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Diagrama muscular — próximamente</p>
              </div>
            </div>
          </div>
        )}
        {tab === 'errors' && (
          <div className="space-y-2.5 pt-1">
            {(exercise.commonErrors || []).map((e, i) => (
              <div key={i} className="rounded-xl bg-muted border border-border p-3.5 space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-foreground">{e.error}</p>
                </div>
                <div className="flex items-start gap-2.5 ml-6">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground leading-relaxed">{e.fix}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

// ─── Warmup Sheet ─────────────────────────────────────────────────────────────

function WarmupSheet({ open, onClose, exercise, warmupSets }) {
  const workWeight = exercise.prevSets?.[1]?.weight || 100
  const est1RM = Math.round(workWeight * 1.18)
  return (
    <BottomSheet open={open} onClose={onClose} title="Calentamiento">
      <div className="px-4 pb-8 pt-3 space-y-3">
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted border border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Peso de trabajo</p>
            <p className="text-xl font-bold text-foreground">{workWeight} kg</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-0.5">1RM estimado</p>
            <p className="text-sm font-semibold text-muted-foreground font-mono">~{est1RM} kg</p>
          </div>
        </div>
        <div className="space-y-2">
          {warmupSets.map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 bg-orange-500/12 text-orange-600 dark:text-orange-400">
                {s.label}
              </span>
              <div className="flex-1">
                <span className="text-sm font-semibold text-foreground">{s.weight} kg × {s.reps} reps</span>
                {s.note && <p className="text-[11px] text-muted-foreground mt-0.5">{s.note}</p>}
              </div>
              <span className="text-xs text-muted-foreground font-mono tabular-nums">{s.pct}</span>
            </div>
          ))}
          <div className="flex justify-center py-0.5">
            <ChevronDown className="w-4 h-4 text-muted-foreground/40" />
          </div>
          <div className="flex items-center gap-3 p-3.5 rounded-xl border"
            style={{ background: `${T}08`, borderColor: `${T}30` }}>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: `${T}20`, color: T }}>S1</span>
            <div className="flex-1">
              <span className="text-sm font-semibold" style={{ color: T }}>{workWeight} kg × objetivo</span>
              <p className="text-[11px] text-muted-foreground mt-0.5">100% · inicio del trabajo real</p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/60 text-center pt-1">Progresión basada en Rippetoe/Prilepin</p>
      </div>
    </BottomSheet>
  )
}

// ─── Swap Sheet ───────────────────────────────────────────────────────────────

const EQUIPMENT_FILTERS = ['Barra', 'Mancuernas', 'Poleas', 'Máquina', 'Bodyweight']

function SwapSheet({ open, onClose, variants }) {
  const [query, setQuery] = useState('')
  const [activeEquip, setActiveEquip] = useState(null)
  const filtered = variants.filter(v => {
    const q = !query || v.name.toLowerCase().includes(query.toLowerCase()) || v.muscles.toLowerCase().includes(query.toLowerCase())
    const e = !activeEquip || v.equipment === activeEquip
    return q && e
  })
  return (
    <BottomSheet open={open} onClose={onClose} title="Buscar variante">
      <div className="px-4 pb-8 pt-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre o músculo..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-background border border-input text-foreground placeholder-muted-foreground/60 text-sm focus:outline-none focus:border-[#F44C40]/50 transition-colors" />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {EQUIPMENT_FILTERS.map(eq => (
            <button key={eq} onClick={() => setActiveEquip(activeEquip === eq ? null : eq)}
              className={cn("flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                activeEquip === eq ? 'text-[#F44C40] border-current' : 'bg-muted text-muted-foreground border-border hover:text-foreground'
              )}
              style={activeEquip === eq ? { background: `${T}12`, borderColor: `${T}40` } : {}}>
              {eq}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Sin resultados</p>
          ) : filtered.map(v => (
            <button key={v.id} onClick={onClose}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:bg-muted/30 active:bg-muted transition-colors text-left">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Dumbbell className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{v.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{v.muscles} · {v.equipment}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <span className={cn("text-sm font-bold",
                  v.similarity >= 85 ? 'text-primary' : v.similarity >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                  {v.similarity}%
                </span>
                <p className="text-[10px] text-muted-foreground">similitud</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  )
}

// ─── Notes Sheet ──────────────────────────────────────────────────────────────

function NotesSheet({
  open,
  onClose,
  exerciseNote,
  sessionNote,
  onExerciseNoteChange,
  onSessionNoteChange,
  onSave,
  saving = false,
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Notas">
      <div className="px-4 pb-8 pt-3 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Del ejercicio</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">Permanente</span>
          </div>
          <textarea value={exerciseNote} onChange={e => onExerciseNoteChange(e.target.value)} rows={3}
            placeholder="Técnica personal, cuing, adaptaciones anatómicas..."
            className="w-full p-3.5 rounded-xl bg-background border border-input text-foreground placeholder-muted-foreground/50 text-sm resize-none focus:outline-none focus:border-[#F44C40]/50 transition-colors leading-relaxed" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Esta sesión</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">Solo hoy</span>
          </div>
          <textarea value={sessionNote} onChange={e => onSessionNoteChange(e.target.value)} rows={3}
            placeholder="Fatiga, dolor, variación usada, sensaciones..."
            className="w-full p-3.5 rounded-xl bg-background border border-input text-foreground placeholder-muted-foreground/50 text-sm resize-none focus:outline-none focus:border-[#F44C40]/50 transition-colors leading-relaxed" />
        </div>
        <Button variant="training" onClick={onSave} disabled={saving} className="w-full h-12">
          {saving ? 'Guardando...' : 'Guardar notas'}
        </Button>
      </div>
    </BottomSheet>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ACTION_CHIPS = [
  { id: 'info',   Icon: Info,     label: 'Info' },
  { id: 'warmup', Icon: Flame,    label: 'Warm Up' },
  { id: 'swap',   Icon: Shuffle,  label: 'Variante' },
  { id: 'notes',  Icon: FileText, label: 'Nota' },
]

export default function ExerciseSessionPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { blockExerciseId, weeklyDayId } = useParams()

  // ── Datos del ejercicio: vienen de location.state (pasado por WorkoutDayPage)
  //    o se usa el mock si se accede directamente a la ruta demo
  const stateExercise      = location.state?.exercise    || null
  const workoutId          = location.state?.workoutId   ?? null
  const workoutExerciseId  = location.state?.workoutExerciseId ?? null
  const allExercises       = useMemo(() => location.state?.allExercises ?? [], [location.state?.allExercises]) // eslint-disable-line react-hooks/exhaustive-deps
  const exerciseMap        = useMemo(() => location.state?.exerciseMap  ?? [], [location.state?.exerciseMap])  // eslint-disable-line react-hooks/exhaustive-deps
  const [resolvedWorkoutExerciseId, setResolvedWorkoutExerciseId] = useState(null)
  const effectiveWorkoutExerciseId = workoutExerciseId ?? resolvedWorkoutExerciseId

  // Ejercicio resuelto: preferimos el estado de navegación, luego el mock
  const baseExercise = useMemo(() => stateExercise || MOCK_EXERCISE, [stateExercise])
  const [hydratedSetsByNo, setHydratedSetsByNo] = useState(null)
  const [exerciseNote, setExerciseNote] = useState(baseExercise.notes || '')
  const [sessionNote, setSessionNote] = useState('')
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  const exercise = useMemo(() => {
    if (!hydratedSetsByNo) return baseExercise
    return {
      ...baseExercise,
      targetSets: Object.keys(hydratedSetsByNo).length || baseExercise.targetSets,
      currentSets: hydratedSetsByNo,
    }
  }, [baseExercise, hydratedSetsByNo])

  const configuredRestSeconds = useMemo(
    () =>
      normalizeRestSeconds(
        exercise.restSeconds
        ?? exercise.rest_seconds
        ?? exercise.default_rest_sec
        ?? REST_DEFAULT_SECONDS
      ),
    [exercise]
  )
  const warmupSets = useMemo(
    () => generateWarmupSets(exercise.prevSets?.[1]?.weight || 100),
    [exercise]
  )
  const initialSets = useMemo(() => buildInitialSets(exercise), [exercise])
  const setMetaById = useMemo(
    () => Object.fromEntries(initialSets.map((set) => [set.id, set])),
    [initialSets]
  )
  const variants    = MOCK_VARIANTS  // en producción vendría de DB por grupo muscular

  // ── Timing refs (no causan re-renders) ──────────────────────────────────────
  const sessionStartedAt   = useRef(null)
  const warmupStartedAt    = useRef(null)
  const warmupEndedAt      = useRef(null)
  const exerciseStartedAt  = useRef(null)
  const activeSetStartedAt = useRef(null)
  const setTimings         = useRef({})
  const workoutTimingStartedRef = useRef(false)

  // ── Display state ────────────────────────────────────────────────────────────
  const [sessionSecs, setSessionSecs]       = useState(0)
  const [currentSetSecs, setCurrentSetSecs] = useState(0)
  const [restSecs, setRestSecs]             = useState(null)
  const [nextSetIdAfterRest, setNextSetIdAfterRest] = useState(null)
  const [isSessionRunning, setIsSessionRunning] = useState(false)
  const pauseStartedAtRef = useRef(null)

  // ── Set & UI state ───────────────────────────────────────────────────────────
  const [setData, setSetData]         = useState({})
  const [activeSetId, setActiveSetId] = useState(null)
  const [openSheet, setOpenSheet]     = useState(null)
  const [showWarmup, setShowWarmup]   = useState(false)
  const [workPhase, setWorkPhase]     = useState('idle') // idle | warmup | work_ready | work
  const [showSummary, setShowSummary] = useState(false)
  const [summary, setSummary]         = useState(null)
  const setRowRefs = useRef({})
  const setDataRef = useRef({})
  const setPersistTimersRef = useRef({})
  const notesPersistTimerRef = useRef(null)
  const notesDirtyRef = useRef(false)

  useEffect(() => {
    setDataRef.current = setData
  }, [setData])

  useEffect(() => {
    let cancelled = false

    const resolveWorkoutExerciseId = async () => {
      if (effectiveWorkoutExerciseId || !workoutId || !blockExerciseId) return
      try {
        const payload = await getWorkoutSessionPayload({ workoutId })
        if (cancelled) return
        const match = (payload.exercises || []).find(
          (item) => String(item.training_block_exercise_id) === String(blockExerciseId)
        )
        if (match?.id) {
          setResolvedWorkoutExerciseId(match.id)
        }
      } catch (error) {
        console.warn('No se pudo resolver workoutExerciseId desde payload:', error?.message || error)
      }
    }

    void resolveWorkoutExerciseId()
    return () => {
      cancelled = true
    }
  }, [effectiveWorkoutExerciseId, workoutId, blockExerciseId])

  useEffect(() => {
    let cancelled = false

    const hydrateTracking = async () => {
      if (!effectiveWorkoutExerciseId) return

      const tracking = await timingService.getWorkoutExerciseTracking(effectiveWorkoutExerciseId)
      if (cancelled || !tracking) return

      const setRows = Array.isArray(tracking.sets) ? tracking.sets : []
      const byNo = Object.fromEntries(
        setRows
          .filter((row) => Number.isFinite(Number(row?.set_no)))
          .map((row) => [Number(row.set_no), row])
      )

      setHydratedSetsByNo(byNo)
      if (!notesDirtyRef.current) {
        setSessionNote(tracking.feedback || '')
        setExerciseNote(tracking.block_exercise_note ?? baseExercise.notes ?? '')
      }
    }

    void hydrateTracking()
    return () => {
      cancelled = true
    }
  }, [effectiveWorkoutExerciseId, baseExercise.notes])

  useEffect(() => {
    setSetData((prev) => {
      const next = {}
      initialSets.forEach((set) => {
        const current = prev[set.id] || {}
        const defaultWeight = set.currentWeight != null ? String(set.currentWeight) : ''
        const defaultReps = set.currentReps != null ? String(set.currentReps) : ''
        next[set.id] = {
          weight: current.weight !== undefined ? current.weight : defaultWeight,
          reps: current.reps !== undefined ? current.reps : defaultReps,
          rir: current.rir !== undefined ? current.rir : (set.currentRir ?? null),
          completed: current.completed !== undefined ? current.completed : Boolean(set.completedAt),
        }

        if (set.startedAt || set.completedAt) {
          setTimings.current[set.id] = {
            startedAt: set.startedAt || null,
            completedAt: set.completedAt || null,
          }
        }
      })
      return next
    })
  }, [initialSets])

  const buildSetPersistencePayload = useCallback((setId, setValues = {}) => {
    const meta = setMetaById[setId]
    if (!meta?.dbSetId) return null

    return {
      setId: meta.dbSetId,
      weight: toNullableInt(setValues.weight),
      reps: toNullableInt(setValues.reps),
      rir: setValues.rir === null || setValues.rir === undefined ? null : Number(setValues.rir),
    }
  }, [setMetaById])

  const persistSetProgress = useCallback(async (setId, overrides = {}, timingOverrides = {}) => {
    const mergedValues = {
      ...(setDataRef.current[setId] || {}),
      ...overrides,
    }
    const payload = buildSetPersistencePayload(setId, mergedValues)
    if (!payload) return

    await timingService.upsertWorkoutSetProgress({
      ...payload,
      startedAt: timingOverrides.startedAt || null,
      completedAt: timingOverrides.completedAt || null,
    })
  }, [buildSetPersistencePayload])

  const scheduleSetPersist = useCallback((setId, nextValues = {}, timingOverrides = {}) => {
    const timers = setPersistTimersRef.current
    if (timers[setId]) clearTimeout(timers[setId])
    timers[setId] = setTimeout(() => {
      void persistSetProgress(setId, nextValues, timingOverrides)
      delete timers[setId]
    }, 450)
  }, [persistSetProgress])

  const persistNotes = useCallback(async ({ closeAfterSave = false } = {}) => {
    if (!effectiveWorkoutExerciseId) {
      if (closeAfterSave) setOpenSheet(null)
      return
    }

    setIsSavingNotes(true)
    const result = await timingService.upsertWorkoutExerciseNotes({
      workoutExerciseId: effectiveWorkoutExerciseId,
      feedback: sessionNote,
      blockExerciseNote: exerciseNote,
    })
    setIsSavingNotes(false)

    if (result) {
      notesDirtyRef.current = false
      if (closeAfterSave) setOpenSheet(null)
    }
  }, [effectiveWorkoutExerciseId, sessionNote, exerciseNote])

  const scheduleNotesPersist = useCallback(() => {
    if (!effectiveWorkoutExerciseId) return
    if (notesPersistTimerRef.current) clearTimeout(notesPersistTimerRef.current)
    notesPersistTimerRef.current = setTimeout(() => {
      if (notesDirtyRef.current) void persistNotes()
    }, 650)
  }, [persistNotes, effectiveWorkoutExerciseId])

  const ensureSessionStarted = useCallback((startedAt = new Date()) => {
    if (sessionStartedAt.current instanceof Date) return sessionStartedAt.current
    sessionStartedAt.current = startedAt
    setSessionSecs(0)
    setIsSessionRunning(true)
    pauseStartedAtRef.current = null

    if (!workoutTimingStartedRef.current) {
      workoutTimingStartedRef.current = true
      timingService.startWorkout(workoutId, startedAt)
    }
    return startedAt
  }, [workoutId])

  const applyPauseOffset = useCallback((offsetMs) => {
    if (!offsetMs || offsetMs <= 0) return

    const shift = (refObj) => {
      if (refObj?.current instanceof Date) {
        refObj.current = new Date(refObj.current.getTime() + offsetMs)
      }
    }

    shift(sessionStartedAt)
    if (!warmupEndedAt.current) shift(warmupStartedAt)
    shift(exerciseStartedAt)
    shift(activeSetStartedAt)

    if (activeSetId && setTimings.current[activeSetId]?.startedAt && !setTimings.current[activeSetId]?.completedAt) {
      setTimings.current[activeSetId].startedAt = new Date(setTimings.current[activeSetId].startedAt.getTime() + offsetMs)
    }
  }, [activeSetId])

  const toggleSessionChrono = useCallback(() => {
    if (!(sessionStartedAt.current instanceof Date)) return

    if (isSessionRunning) {
      pauseStartedAtRef.current = new Date()
      setIsSessionRunning(false)
      return
    }

    const resumedAt = new Date()
    const pausedAt = pauseStartedAtRef.current
    if (pausedAt instanceof Date) {
      applyPauseOffset(resumedAt.getTime() - pausedAt.getTime())
    }
    pauseStartedAtRef.current = null
    setIsSessionRunning(true)
  }, [applyPauseOffset, isSessionRunning])

  // ── Tick cada segundo ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (!isSessionRunning || !(sessionStartedAt.current instanceof Date)) return
      const now = new Date()
      setSessionSecs(Math.floor((now - sessionStartedAt.current) / 1000))
      if (activeSetStartedAt.current) {
        setCurrentSetSecs(Math.floor((now - activeSetStartedAt.current) / 1000))
      }
    }, 1000)
    return () => clearInterval(id)
  }, [isSessionRunning])

  const activateSet = useCallback((setId, startedAt = new Date()) => {
    if (!exerciseStartedAt.current) {
      exerciseStartedAt.current = startedAt
    }
    activeSetStartedAt.current = startedAt
    setTimings.current[setId] = { startedAt, completedAt: null }
    setCurrentSetSecs(0)
    setActiveSetId(setId)
    void persistSetProgress(setId, {}, { startedAt })
  }, [persistSetProgress])

  const finishRestAndStartNextSet = useCallback((skipToNext = true) => {
    setRestSecs(null)
    activeSetStartedAt.current = null
    setCurrentSetSecs(0)

    if (!skipToNext || !nextSetIdAfterRest) {
      setNextSetIdAfterRest(null)
      return
    }

    const now = new Date()
    activateSet(nextSetIdAfterRest, now)
    setNextSetIdAfterRest(null)
  }, [activateSet, nextSetIdAfterRest])

  // ── Rest countdown ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (restSecs === null) return
    if (!isSessionRunning) return

    if (restSecs <= 0) {
      finishRestAndStartNextSet(true)
      return
    }

    const id = setTimeout(() => {
      setRestSecs((prev) => (prev === null ? null : prev - 1))
    }, 1000)

    return () => clearTimeout(id)
  }, [finishRestAndStartNextSet, isSessionRunning, restSecs])

  useEffect(() => {
    if (!activeSetId) return
    const node = setRowRefs.current[activeSetId]
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeSetId])

  const startWarmupPhase = useCallback(() => {
    const now = new Date()
    ensureSessionStarted(now)
    if (!warmupStartedAt.current) {
      warmupStartedAt.current = now
    }
    setShowWarmup(true)
    setWorkPhase('warmup')
  }, [ensureSessionStarted])

  const finishWarmupPhase = useCallback(() => {
    const now = new Date()
    ensureSessionStarted(now)

    if (!warmupStartedAt.current) {
      warmupStartedAt.current = now
    }
    warmupEndedAt.current = now
    timingService.markWarmupTiming(workoutId, warmupStartedAt.current, now)
    setWorkPhase('work_ready')
    setShowWarmup(false)
  }, [ensureSessionStarted, workoutId])

  const startEffectiveSetsPhase = useCallback(() => {
    const now = new Date()
    ensureSessionStarted(now)

    if (!warmupEndedAt.current) {
      warmupEndedAt.current = now
      if (warmupStartedAt.current) {
        timingService.markWarmupTiming(workoutId, warmupStartedAt.current, now)
      }
    }

    const firstPendingSet = initialSets.find((set) => !setData[set.id]?.completed)
    if (firstPendingSet) {
      setWorkPhase('work')
      setRestSecs(null)
      setNextSetIdAfterRest(null)
      activateSet(firstPendingSet.id, now)
    }
  }, [activateSet, ensureSessionStarted, initialSets, setData, workoutId])

  const toggleWarmupList = useCallback(() => {
    setShowWarmup((prev) => !prev)
  }, [])

  // ── Activar una serie ─────────────────────────────────────────────────────────
  const selectSet = useCallback((setId) => {
    if (workPhase !== 'work') return
    if (restSecs !== null) return
    if (!(sessionStartedAt.current instanceof Date)) return

    const now = new Date()
    activateSet(setId, now)
  }, [activateSet, restSecs, workPhase])

  // ── Completar una serie ───────────────────────────────────────────────────────
  const completeSet = useCallback((setId) => {
    if (restSecs !== null) return

    const meta = setMetaById[setId]
    if (!meta) return

    const current = setDataRef.current[setId] || {}
    const resolvedWeight = current.weight || (meta.prevWeight != null ? String(meta.prevWeight) : String(meta.targetWeight ?? ''))
    const resolvedReps = current.reps || (meta.prevReps != null ? String(meta.prevReps) : '')

    const completedAt = new Date()
    ensureSessionStarted(completedAt)

    // Actualizar timing local
    setTimings.current[setId] = {
      ...(setTimings.current[setId] || { startedAt: activeSetStartedAt.current }),
      completedAt,
    }

    // Guardar progreso y timing en DB con el set_id real
    const persistedSet = {
      ...(current || {}),
      weight: resolvedWeight,
      reps: resolvedReps,
      completed: true,
    }
    setDataRef.current = { ...setDataRef.current, [setId]: persistedSet }
    setSetData(prev => ({ ...prev, [setId]: persistedSet }))

    if (setPersistTimersRef.current[setId]) {
      clearTimeout(setPersistTimersRef.current[setId])
      delete setPersistTimersRef.current[setId]
    }
    void persistSetProgress(setId, persistedSet, {
      startedAt: setTimings.current[setId].startedAt || null,
      completedAt,
    })

    // Preparar la siguiente serie
    const idx = initialSets.findIndex(s => s.id === setId)
    if (idx < initialSets.length - 1) {
      const nextSetId = initialSets[idx + 1].id
      setActiveSetId(nextSetId)
      setNextSetIdAfterRest(nextSetId)
      setRestSecs(configuredRestSeconds)
    } else {
      setActiveSetId(null)
      setNextSetIdAfterRest(null)
      setRestSecs(null)
    }
    activeSetStartedAt.current = null
    setCurrentSetSecs(0)
  }, [configuredRestSeconds, ensureSessionStarted, initialSets, restSecs, setMetaById, persistSetProgress])

  const currentExerciseIndex = useMemo(() => {
    if (!allExercises.length) return -1
    const idx = allExercises.findIndex(e => String(e.blockExerciseId) === String(blockExerciseId))
    return idx >= 0 ? idx : 0
  }, [allExercises, blockExerciseId])

  const nextExercise = useMemo(() => {
    if (currentExerciseIndex < 0 || !allExercises.length) return null
    return allExercises[currentExerciseIndex + 1] ?? null
  }, [allExercises, currentExerciseIndex])

  const navigatingToNextRef = useRef(false)

  const navigateToExercise = useCallback((ex) => {
    navigatingToNextRef.current = true
    const mapping = exerciseMap.find(
      m => String(m.block_exercise_id) === String(ex.blockExerciseId)
    )
    navigate(
      `/plan/entreno/dia/${weeklyDayId}/ejercicio/${ex.blockExerciseId}`,
      {
        state: {
          exercise: ex,
          workoutId,
          workoutExerciseId: mapping?.workout_exercise_id ?? null,
          allExercises,
          exerciseMap,
          weeklyDayId,
        },
      }
    )
  }, [exerciseMap, navigate, weeklyDayId, workoutId, allExercises])

  // ── Ejercicio completado ───────────────────────────────────────────────────────
  const handleAllCompleted = useCallback(() => {
    const now = new Date()

    if (workoutId && effectiveWorkoutExerciseId && exerciseStartedAt.current) {
      timingService.recordExerciseTiming(effectiveWorkoutExerciseId, exerciseStartedAt.current, now)
      // Solo cerrar el workout si es el último ejercicio del día
      const isLastExercise = !allExercises.length || currentExerciseIndex >= allExercises.length - 1
      if (isLastExercise) {
        timingService.finishWorkout(workoutId, now)
      }
    }

    const localSummary = timingService.computeLocalSummary({
      sessionStartedAt: sessionStartedAt.current || now,
      warmupStartedAt: warmupStartedAt.current,
      warmupEndedAt: warmupEndedAt.current,
      setTimings: setTimings.current,
    })
    setSummary(localSummary)
    setShowSummary(true)
  }, [workoutId, effectiveWorkoutExerciseId, allExercises, currentExerciseIndex])

  const updateSet = useCallback((id, data) => {
    setSetData(prev => {
      const next = { ...prev, [id]: data }
      setDataRef.current = next
      return next
    })
    scheduleSetPersist(id, data)
  }, [scheduleSetPersist])

  const handleExerciseNoteChange = useCallback((value) => {
    notesDirtyRef.current = true
    setExerciseNote(value)
    scheduleNotesPersist()
  }, [scheduleNotesPersist])

  const handleSessionNoteChange = useCallback((value) => {
    notesDirtyRef.current = true
    setSessionNote(value)
    scheduleNotesPersist()
  }, [scheduleNotesPersist])

  const handleSaveNotes = useCallback(() => {
    void persistNotes({ closeAfterSave: true })
  }, [persistNotes])

  const allCompleted = initialSets.every(s => setData[s.id]?.completed)

  // Mostrar resumen automáticamente al completar todos los sets
  useEffect(() => {
    if (allCompleted && !showSummary) {
      handleAllCompleted()
    }
  }, [allCompleted]) // eslint-disable-line

  useEffect(() => {
    return () => {
      Object.values(setPersistTimersRef.current).forEach((timerId) => clearTimeout(timerId))
      setPersistTimersRef.current = {}

      initialSets.forEach((set) => {
        if (!set.dbSetId) return
        const timing = setTimings.current[set.id] || {}
        void persistSetProgress(set.id, setDataRef.current[set.id] || {}, {
          startedAt: timing.startedAt || null,
          completedAt: timing.completedAt || null,
        })
      })

      if (notesPersistTimerRef.current) {
        clearTimeout(notesPersistTimerRef.current)
        notesPersistTimerRef.current = null
      }
      if (notesDirtyRef.current) {
        void persistNotes()
      }

      if (workoutId && sessionStartedAt.current instanceof Date && !navigatingToNextRef.current) {
        void timingService.finishWorkout(workoutId, new Date())
      }
    }
  }, [initialSets, persistNotes, persistSetProgress, workoutId])

  return (
    <div className="h-[100dvh] bg-background text-foreground flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="px-4 pt-3 pb-2 bg-background/95 backdrop-blur-sm sticky top-0 z-20 border-b border-border">

        {/* Fila 1: Botón atrás + pills de ejercicios del día */}
        <div className="flex items-center gap-2 mb-2.5">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {allExercises.length > 0 ? (
            <div className="flex-1 flex gap-1.5 overflow-x-auto no-scrollbar">
              {allExercises.map((ex, idx) => {
                const isCurrent = String(ex.blockExerciseId) === String(blockExerciseId)
                return (
                  <button
                    key={ex.blockExerciseId}
                    onClick={() => { if (!isCurrent) navigateToExercise(ex) }}
                    title={ex.name}
                    className={cn(
                      'flex-shrink-0 min-w-[28px] h-7 px-2 rounded-full text-xs font-bold border transition-all active:scale-95',
                      isCurrent
                        ? 'text-white border-transparent'
                        : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                    )}
                    style={isCurrent ? { background: T, borderColor: T } : {}}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="flex-1 text-sm font-semibold text-foreground truncate">{exercise.name}</p>
          )}
        </div>

        {/* Fila 2: Zona de acción / cronómetro — se transforma según la fase */}
        <AnimatePresence mode="wait" initial={false}>
          {restSecs !== null ? (
            (() => {
              const safeTotal = Math.max(configuredRestSeconds || REST_DEFAULT_SECONDS, 1)
              const pct = Math.max(0, Math.min(100, (restSecs / safeTotal) * 100))
              const intensity = 1 - (restSecs / safeTotal)
              const tone = intensity > 0.67 ? 'hard' : intensity > 0.33 ? 'mid' : 'easy'
              return (
                <motion.div
                  key="rest"
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-xl border',
                    tone === 'hard' ? 'border-red-500/30 bg-red-500/10'
                      : tone === 'mid' ? 'border-amber-500/30 bg-amber-500/10'
                      : 'border-emerald-500/30 bg-emerald-500/10'
                  )}
                >
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Clock className={cn(
                      'w-3.5 h-3.5',
                      tone === 'hard' ? 'text-red-500' : tone === 'mid' ? 'text-amber-500' : 'text-emerald-500'
                    )} />
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold leading-none">
                        Descanso
                      </p>
                      <p className={cn(
                        'font-mono tabular-nums text-base font-bold mt-0.5 leading-none',
                        tone === 'hard' ? 'text-red-500'
                          : tone === 'mid' ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-500'
                      )}>
                        {fmt(restSecs)}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-[width] duration-1000 ease-linear',
                        tone === 'hard' ? 'bg-red-500' : tone === 'mid' ? 'bg-amber-500' : 'bg-emerald-500'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <button
                    onClick={() => finishRestAndStartNextSet(true)}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-card/70 border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    Saltar
                  </button>
                </motion.div>
              )
            })()
          ) : workPhase === 'idle' ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                variant="outline"
                onClick={startWarmupPhase}
                className="w-full h-10 border-orange-400/40 text-orange-600 hover:text-orange-500 hover:bg-orange-500/10"
              >
                <Flame className="w-4 h-4 mr-2" />
                Iniciar calentamiento
              </Button>
            </motion.div>
          ) : workPhase === 'warmup' ? (
            <motion.div
              key="warmup"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              <div className="flex flex-col flex-1 min-w-0 pl-1">
                <span className="text-base font-bold font-mono tabular-nums text-foreground tracking-tight leading-none">
                  {fmt(sessionSecs)}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                  {isSessionRunning ? 'Calentamiento' : 'Pausado'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSessionChrono}
                className="flex-shrink-0 h-9 px-3 gap-1.5 border-orange-400/40 text-orange-600 hover:text-orange-500 hover:bg-orange-500/10"
              >
                {isSessionRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isSessionRunning ? 'Pausar' : 'Reanudar'}
              </Button>
              <Button
                size="sm"
                onClick={finishWarmupPhase}
                className="flex-shrink-0 h-9 px-4"
                style={{ background: '#f59e0b', color: 'white' }}
              >
                Listo
              </Button>
            </motion.div>
          ) : workPhase === 'work_ready' ? (
            <motion.div
              key="work_ready"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                onClick={startEffectiveSetsPhase}
                className="w-full h-10 text-white"
                style={{ background: T }}
              >
                Iniciar series efectivas
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="work"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-between"
            >
              <button
                type="button"
                onClick={toggleSessionChrono}
                className={cn(
                  'flex flex-col rounded-lg px-2 py-1 transition-colors',
                  !isSessionRunning ? 'bg-amber-500/10 hover:bg-amber-500/15' : 'hover:bg-muted/60'
                )}
              >
                <div className="flex items-center gap-1.5">
                  {isSessionRunning ? (
                    <Pause className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span className="text-base font-bold font-mono tabular-nums text-foreground tracking-tight">
                    {fmt(sessionSecs)}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  {isSessionRunning ? 'Sesión' : 'Pausado'}
                </span>
              </button>

              {activeSetId && !setData[activeSetId]?.completed && (
                <div className="flex flex-col items-end">
                  <span className="text-sm font-bold font-mono tabular-nums" style={{ color: T }}>
                    {fmt(currentSetSecs)}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Serie</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fila 3: Barra de progreso de series (solo en fase work) */}
        {workPhase === 'work' && (
          <div className="mt-2.5 flex gap-1.5">
            {initialSets.map(s => (
              <div key={s.id} className={cn(
                'h-1.5 flex-1 rounded-full transition-all duration-300',
                setData[s.id]?.completed ? 'bg-primary'
                  : s.id === activeSetId ? 'bg-[#F44C40]'
                  : 'bg-border'
              )} />
            ))}
          </div>
        )}
      </header>

      {/* ── Cuerpo ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">

        {/* Action chips */}
        <div className="flex gap-2 px-4 pt-3 pb-2 overflow-x-auto no-scrollbar">
          {ACTION_CHIPS.map(({ id, Icon, label }) => (
            <button key={id} onClick={() => setOpenSheet(id)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-card border border-border text-muted-foreground text-sm font-medium hover:text-foreground hover:bg-muted/40 active:scale-95 transition-all">
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Hero media + name */}
        <div className="px-4 pt-3 pb-2">
          <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
            <div className="pt-2">
              <MediaStrip phases={exercise.mediaPhases || []} />
            </div>
            <div className="px-4 pb-4 pt-2">
              <h1 className="text-xl font-bold text-foreground leading-tight">{exercise.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{exercise.equipment}</p>
            </div>
          </div>

          {/* RIR alert */}
          {exercise.rirAlert && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/8 border border-amber-400/25">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 leading-snug">{exercise.rirAlert.title}</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">{exercise.rirAlert.action}</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Sets */}
        <div className="px-4 pb-6 space-y-2">

          <SectionDivider label="Calentamiento" count={`${warmupSets.length} series`} tone="warmup" />

          <button
            onClick={toggleWarmupList}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-card border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500/80" />
              <span className="font-medium">Calentamiento</span>
              <span className="text-muted-foreground/60 text-xs">({warmupSets.length} series)</span>
            </span>
            {showWarmup ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <AnimatePresence>
            {showWarmup && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="space-y-1.5 pb-1">
                  {warmupSets.map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-card border border-border">
                      <span className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {s.label}
                      </span>
                      <div className="flex-1">
                        <span className="text-sm text-foreground font-medium">{s.weight} kg × {s.reps} reps</span>
                        {s.note && <span className="text-xs text-muted-foreground ml-2">{s.note}</span>}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{s.pct}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <SectionDivider label="Series de trabajo" count={`${initialSets.length} series`} />

          {/* Working sets */}
          {initialSets.map(set => (
            <div
              key={set.id}
              ref={(node) => {
                if (node) setRowRefs.current[set.id] = node
              }}
            >
              <WorkingSetRow
                set={set}
                setData={setData}
                isActive={activeSetId === set.id && !setData[set.id]?.completed}
                currentSetSecs={currentSetSecs}
                onSelect={() => selectSet(set.id)}
                onUpdate={updateSet}
                onComplete={completeSet}
              />
            </div>
          ))}

          <div className="h-6" />
        </div>
      </div>

      {/* ── Sheets & Modals ─────────────────────────────────────────────────── */}
      <InfoSheet   open={openSheet === 'info'}   onClose={() => setOpenSheet(null)} exercise={exercise} />
      <WarmupSheet open={openSheet === 'warmup'} onClose={() => setOpenSheet(null)} exercise={exercise} warmupSets={warmupSets} />
      <SwapSheet   open={openSheet === 'swap'}   onClose={() => setOpenSheet(null)} variants={variants} />
      <NotesSheet
        open={openSheet === 'notes'}
        onClose={() => setOpenSheet(null)}
        exerciseNote={exerciseNote}
        sessionNote={sessionNote}
        onExerciseNoteChange={handleExerciseNoteChange}
        onSessionNoteChange={handleSessionNoteChange}
        onSave={handleSaveNotes}
        saving={isSavingNotes}
      />

      <SummaryModal
        open={showSummary}
        summary={summary}
        exerciseName={exercise.name}
        totalSets={initialSets.length}
        nextExerciseName={nextExercise?.name ?? null}
        onClose={() => {
          setShowSummary(false)
          if (nextExercise) {
            navigateToExercise(nextExercise)
          } else {
            navigate(`/plan/entreno/dia/${weeklyDayId}`)
          }
        }}
      />
    </div>
  )
}
