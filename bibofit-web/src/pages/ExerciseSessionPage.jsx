import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Info, Flame, Shuffle, FileText,
  Search, X, Check, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, TrendingUp,
  Dumbbell, Clock, SkipForward, Timer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import * as timingService from '@/lib/exerciseTimingService'

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

const MOCK_WARMUP = [
  { id: 'w1', label: 'W1', weight: 20,  reps: 8, pct: '11%', note: 'Barra sola · activación neural' },
  { id: 'w2', label: 'W2', weight: 60,  reps: 5, pct: '34%', note: '' },
  { id: 'w3', label: 'W3', weight: 100, reps: 3, pct: '57%', note: '' },
  { id: 'w4', label: 'W4', weight: 140, reps: 2, pct: '80%', note: '' },
]

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
  const n       = exercise.targetSets || 4
  const prevS   = exercise.prevSets || {}
  const prevW1  = prevS[1]?.weight || null
  return Array.from({ length: n }, (_, i) => {
    const no   = i + 1
    const prev = prevS[no]
    return {
      id:           `s${no}`,
      no,
      targetMin:    exercise.targetRepsMin || 8,
      targetMax:    exercise.targetRepsMax || 12,
      targetWeight: prev?.weight ?? prevW1 ?? 0,
      prevWeight:   prev?.weight ?? null,
      prevReps:     prev?.reps   ?? null,
      prevRir:      prev?.rir    ?? null,
    }
  })
}

const REST_SECONDS = 180

// ─── Utils ────────────────────────────────────────────────────────────────────

/** Formatea segundos como MM:SS */
function fmt(secs) {
  const m = Math.floor(Math.abs(secs) / 60).toString().padStart(2, '0')
  const s = (Math.abs(secs) % 60).toString().padStart(2, '0')
  return `${m}:${s}`
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

// ─── RIR Selector ─────────────────────────────────────────────────────────────

const RIR_OPTIONS = [
  { label: 'Fallo', val: 0   },
  { label: '1',     val: 1   },
  { label: '2',     val: 2   },
  { label: '3',     val: 3   },
  { label: '4',     val: 4   },
  { label: '5+',    val: 5   },
  { label: '?',     val: null },
]

function RirSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[11px] text-muted-foreground font-semibold tracking-widest uppercase shrink-0">RIR</span>
      <div className="flex gap-1.5 flex-wrap">
        {RIR_OPTIONS.map(({ label, val }) => {
          const isSelected = value === val
          const zone = val !== null ? getRirZone(val) : null
          return (
            <button
              key={label}
              onClick={() => onChange(isSelected && val !== null ? null : val)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all duration-150 select-none",
                isSelected && zone
                  ? `${zone.chip} border-current scale-105`
                  : isSelected
                  ? 'bg-muted text-foreground border-border scale-105'
                  : 'bg-muted/50 text-muted-foreground border-border hover:text-foreground hover:border-border/80'
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
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

function RestTimer({ seconds, total, onSkip }) {
  const pct = (seconds / total) * 100
  const r = 26, circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const isLow = seconds <= 30

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-2.5 shadow-sm"
    >
      <div className="relative w-12 h-12 flex-shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r={r} stroke="currentColor" strokeWidth="3" fill="none" className="text-border" />
          <circle cx="30" cy="30" r={r} stroke="currentColor" strokeWidth="3" fill="none"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            className={isLow ? 'text-amber-500' : 'text-primary'}
            style={{ transition: 'stroke-dashoffset 1s linear, color 0.3s' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-[11px] font-bold tabular-nums", isLow ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
            {fmt(seconds)}
          </span>
        </div>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">Descansando</p>
        <p className="text-xs text-muted-foreground">Próxima serie en {fmt(seconds)}</p>
      </div>
      <button onClick={onSkip} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:text-foreground transition-colors">
        <SkipForward className="w-3.5 h-3.5" />
        Saltar
      </button>
    </motion.div>
  )
}

// ─── Session Summary Modal ────────────────────────────────────────────────────

function SummaryModal({ open, summary, onClose, exerciseName, totalSets }) {
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
                <Check className="w-4 h-4" />
                Continuar sesión
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
  const d = setData[set.id] || { weight: String(set.targetWeight), reps: '', rir: null, completed: false }
  const zone = d.rir !== null && d.rir !== undefined ? getRirZone(d.rir) : null
  const repsDiff = (d.reps && set.prevReps) ? parseInt(d.reps) - set.prevReps : null
  const prevZone = set.prevRir !== null ? getRirZone(set.prevRir) : null

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
        <div className="flex items-center gap-3">
          {/* Set badge */}
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors",
            d.completed ? 'bg-primary/15 text-primary'
              : isActive ? 'bg-[#F44C40]/15 text-[#F44C40]'
              : 'bg-muted text-muted-foreground'
          )}>
            {d.completed ? <Check className="w-3.5 h-3.5" /> : set.no}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              Obj: <span className="text-foreground font-medium">{set.targetMin}–{set.targetMax} reps</span>
            </p>
          </div>

          {/* Mini set timer when active */}
          {isActive && !d.completed && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
              <Timer className="w-3 h-3" />
              <span className="font-mono">{fmt(currentSetSecs)}</span>
            </div>
          )}

          {/* Summary when collapsed */}
          {(!isActive || d.completed) && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {d.weight && <span className="text-sm text-foreground font-medium">{d.weight} kg</span>}
              {d.reps && (
                <span className={cn(
                  "text-sm font-bold",
                  repsDiff > 0 ? 'text-primary' : repsDiff < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                )}>
                  ×{d.reps}
                  {repsDiff !== null && repsDiff !== 0 && (
                    <span className="text-[10px] ml-0.5 opacity-70">
                      {repsDiff > 0 ? `+${repsDiff}▲` : `${repsDiff}▼`}
                    </span>
                  )}
                </span>
              )}
              {zone && (
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold", zone.chip)}>
                  {zone.label}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Previous session data — por número de serie exacto */}
        <div className="mt-1.5 ml-11 flex items-center gap-2 flex-wrap">
          <p className="text-[11px] text-muted-foreground">
            S{set.no} anterior: <span className="text-foreground/70">{set.prevWeight} kg × {set.prevReps} reps</span>
          </p>
          {prevZone && (
            <span className={cn("text-[10px] font-semibold", prevZone.tipColor)}>· {prevZone.label}</span>
          )}
        </div>
      </button>

      {/* Expanded inputs */}
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
                    placeholder={String(set.targetWeight)}
                    className="w-full h-12 rounded-xl bg-background border border-input text-foreground font-bold text-center text-base focus:outline-none focus:border-[#F44C40]/60 focus:ring-1 focus:ring-[#F44C40]/20 transition-all placeholder-muted-foreground/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <p className="text-[10px] text-muted-foreground text-center mt-1">ant: {set.prevWeight} kg</p>
                </div>
                <div>
                  <label className="block text-[11px] text-muted-foreground font-semibold mb-1.5 uppercase tracking-wide">Reps</label>
                  <input
                    type="number" inputMode="numeric"
                    value={d.reps}
                    onChange={e => onUpdate(set.id, { ...d, reps: e.target.value })}
                    placeholder={`${set.targetMin}–${set.targetMax}`}
                    className="w-full h-12 rounded-xl bg-background border border-input text-foreground font-bold text-center text-base focus:outline-none focus:border-[#F44C40]/60 focus:ring-1 focus:ring-[#F44C40]/20 transition-all placeholder-muted-foreground/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <p className="text-[10px] text-muted-foreground text-center mt-1">ant: {set.prevReps} reps</p>
                </div>
              </div>

              <RirSelector value={d.rir} onChange={v => onUpdate(set.id, { ...d, rir: v })} />

              {zone && (
                <div className={cn("flex items-center gap-1.5 text-[11px]", zone.tipColor)}>
                  <zone.icon className="w-3 h-3 flex-shrink-0" />
                  <span>{zone.tip}</span>
                </div>
              )}

              <Button
                variant="training"
                onClick={() => onComplete(set.id)}
                disabled={!d.weight || !d.reps}
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

function NotesSheet({ open, onClose }) {
  const [exerciseNote, setExerciseNote] = useState('Agarre mixto. Pie izq ligeramente rotado hacia fuera.')
  const [sessionNote, setSessionNote]   = useState('')
  return (
    <BottomSheet open={open} onClose={onClose} title="Notas">
      <div className="px-4 pb-8 pt-3 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Del ejercicio</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">Permanente</span>
          </div>
          <textarea value={exerciseNote} onChange={e => setExerciseNote(e.target.value)} rows={3}
            placeholder="Técnica personal, cuing, adaptaciones anatómicas..."
            className="w-full p-3.5 rounded-xl bg-background border border-input text-foreground placeholder-muted-foreground/50 text-sm resize-none focus:outline-none focus:border-[#F44C40]/50 transition-colors leading-relaxed" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Esta sesión</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">Solo hoy</span>
          </div>
          <textarea value={sessionNote} onChange={e => setSessionNote(e.target.value)} rows={3}
            placeholder="Fatiga, dolor, variación usada, sensaciones..."
            className="w-full p-3.5 rounded-xl bg-background border border-input text-foreground placeholder-muted-foreground/50 text-sm resize-none focus:outline-none focus:border-[#F44C40]/50 transition-colors leading-relaxed" />
        </div>
        <Button variant="training" onClick={onClose} className="w-full h-12">Guardar notas</Button>
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
  const { weeklyDayId, blockExerciseId } = useParams()

  // ── Datos del ejercicio: vienen de location.state (pasado por WorkoutDayPage)
  //    o se usa el mock si se accede directamente a la ruta demo
  const stateExercise      = location.state?.exercise    || null
  const workoutId          = location.state?.workoutId   ?? null
  const workoutExerciseId  = location.state?.workoutExerciseId ?? null

  // Ejercicio resuelto: preferimos el estado de navegación, luego el mock
  const exercise  = stateExercise || MOCK_EXERCISE
  const warmupSets = useMemo(
    () => generateWarmupSets(exercise.prevSets?.[1]?.weight || 100),
    [exercise]
  )
  const initialSets = useMemo(() => buildInitialSets(exercise), [exercise])
  const variants    = MOCK_VARIANTS  // en producción vendría de DB por grupo muscular

  // ── Timing refs (no causan re-renders) ──────────────────────────────────────
  const sessionStartedAt   = useRef(new Date())
  const warmupStartedAt    = useRef(null)
  const warmupEndedAt      = useRef(null)
  const exerciseStartedAt  = useRef(null)
  const activeSetStartedAt = useRef(null)
  const setTimings         = useRef({})

  // ── Display state ────────────────────────────────────────────────────────────
  const [sessionSecs, setSessionSecs]       = useState(0)
  const [currentSetSecs, setCurrentSetSecs] = useState(0)
  const [restSecs, setRestSecs]             = useState(null)

  // ── Set & UI state ───────────────────────────────────────────────────────────
  const [setData, setSetData]         = useState({})
  const [activeSetId, setActiveSetId] = useState(null)
  const [openSheet, setOpenSheet]     = useState(null)
  const [showWarmup, setShowWarmup]   = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [summary, setSummary]         = useState(null)

  // ── Tick cada segundo ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date()
      setSessionSecs(Math.floor((now - sessionStartedAt.current) / 1000))
      if (activeSetStartedAt.current) {
        setCurrentSetSecs(Math.floor((now - activeSetStartedAt.current) / 1000))
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Inicia timing en DB al montar
  useEffect(() => {
    timingService.startWorkout(workoutId, sessionStartedAt.current)
  }, []) // eslint-disable-line

  // ── Rest countdown ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (restSecs === null || restSecs <= 0) {
      if (restSecs === 0) setRestSecs(null)
      return
    }
    const id = setTimeout(() => setRestSecs(s => s - 1), 1000)
    return () => clearTimeout(id)
  }, [restSecs])

  // ── Warmup toggle → registra inicio de calentamiento ─────────────────────────
  const handleToggleWarmup = useCallback(() => {
    if (!warmupStartedAt.current) {
      warmupStartedAt.current = new Date()
    }
    setShowWarmup(v => !v)
  }, [])

  // ── Activar una serie ─────────────────────────────────────────────────────────
  const selectSet = useCallback((setId) => {
    const now = new Date()

    // Primera serie de trabajo: cierra el calentamiento
    if (!warmupEndedAt.current) {
      warmupEndedAt.current = now
      if (warmupStartedAt.current) {
        timingService.markWarmupTiming(workoutId, warmupStartedAt.current, now)
      }
    }

    // Primera vez que se activa cualquier serie: inicio del ejercicio
    if (!exerciseStartedAt.current) {
      exerciseStartedAt.current = now
    }

    activeSetStartedAt.current = now
    setTimings.current[setId] = { startedAt: now, completedAt: null }
    setCurrentSetSecs(0)
    setActiveSetId(setId)
  }, [workoutId])

  // ── Completar una serie ───────────────────────────────────────────────────────
  const completeSet = useCallback((setId) => {
    const completedAt = new Date()

    // Actualizar timing local
    setTimings.current[setId] = {
      ...(setTimings.current[setId] || { startedAt: activeSetStartedAt.current }),
      completedAt,
    }

    // Guardar en DB (fire-and-forget)
    // En producción, setId sería el ID real de exercise_sets
    if (workoutId && setTimings.current[setId].startedAt) {
      timingService.recordSetCompletion(
        null, // setId real de DB, por ahora null en demo
        setTimings.current[setId].startedAt,
        completedAt
      )
    }

    // Marcar como completada en state
    setSetData(prev => ({ ...prev, [setId]: { ...(prev[setId] || {}), completed: true } }))

    // Iniciar descanso
    setRestSecs(REST_SECONDS)

    // Avanzar a la siguiente serie
    const idx = initialSets.findIndex(s => s.id === setId)
    if (idx < initialSets.length - 1) {
      setActiveSetId(initialSets[idx + 1].id)
      // Pre-registrar start de la siguiente serie (se actualizará cuando el usuario la active)
    }
  }, [workoutId, initialSets])

  // ── Ejercicio completado ───────────────────────────────────────────────────────
  const handleAllCompleted = useCallback(() => {
    const now = new Date()

    // Guardar timing del ejercicio
    if (workoutId && exerciseStartedAt.current) {
      timingService.recordExerciseTiming(workoutExerciseId, exerciseStartedAt.current, now)
      timingService.finishWorkout(workoutId, now)
    }

    // Calcular resumen local (inmediato, sin esperar DB)
    const localSummary = timingService.computeLocalSummary({
      sessionStartedAt: sessionStartedAt.current,
      warmupStartedAt: warmupStartedAt.current,
      warmupEndedAt: warmupEndedAt.current,
      setTimings: setTimings.current,
    })
    setSummary(localSummary)
    setShowSummary(true)
  }, [workoutId, workoutExerciseId])

  const updateSet = useCallback((id, data) => {
    setSetData(prev => ({ ...prev, [id]: data }))
  }, [])

  const completedCount = initialSets.filter(s => setData[s.id]?.completed).length
  const allCompleted   = completedCount === initialSets.length

  // Mostrar resumen automáticamente al completar todos los sets
  useEffect(() => {
    if (allCompleted && !showSummary) {
      handleAllCompleted()
    }
  }, [allCompleted]) // eslint-disable-line

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 pt-12 pb-3 bg-background/95 backdrop-blur-sm sticky top-0 z-20 border-b border-border">
        <button onClick={() => navigate(-1)}
          className="p-1.5 -ml-1 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Cronómetro principal — siempre corriendo desde el inicio */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-base font-bold font-mono tabular-nums text-foreground tracking-tight">
              {fmt(sessionSecs)}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Sesión</span>
        </div>

        {/* Indicador de serie activa */}
        <div className="flex flex-col items-end min-w-[52px]">
          {activeSetId && !setData[activeSetId]?.completed ? (
            <>
              <span className="text-sm font-bold font-mono tabular-nums" style={{ color: T }}>
                {fmt(currentSetSecs)}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Serie</span>
            </>
          ) : (
            <div className="w-[52px]" />
          )}
        </div>
      </header>

      {/* ── Cuerpo ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain">

        {/* Rest timer */}
        <AnimatePresence>
          {restSecs !== null && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="px-4 pt-3">
                <RestTimer seconds={restSecs} total={REST_SECONDS} onSkip={() => setRestSecs(0)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Media strip */}
        <div className="pt-4 pb-1">
          <MediaStrip phases={exercise.mediaPhases || []} />
        </div>

        {/* Exercise title + progress */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground leading-tight">{exercise.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{exercise.equipment}</p>
            </div>
            <div className="text-right flex-shrink-0 pt-0.5">
              <p className="text-sm font-bold text-foreground">{completedCount}/{initialSets.length}</p>
              <p className="text-xs text-muted-foreground">series</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1.5 mt-3">
            {initialSets.map(s => (
              <div key={s.id} className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-300",
                setData[s.id]?.completed ? 'bg-primary'
                  : s.id === activeSetId ? 'bg-[#F44C40]'
                  : 'bg-border'
              )} />
            ))}
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

        {/* Action chips */}
        <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar pb-3">
          {ACTION_CHIPS.map(({ id, Icon, label }) => (
            <button key={id} onClick={() => setOpenSheet(id)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-card border border-border text-muted-foreground text-sm font-medium hover:text-foreground hover:bg-muted/40 active:scale-95 transition-all">
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Sets */}
        <div className="px-4 pb-6 space-y-2">

          {/* Warmup toggle */}
          <button onClick={handleToggleWarmup}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-card border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
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

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Series de trabajo</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Working sets */}
          {initialSets.map(set => (
            <WorkingSetRow
              key={set.id}
              set={set}
              setData={setData}
              isActive={activeSetId === set.id && !setData[set.id]?.completed}
              currentSetSecs={currentSetSecs}
              onSelect={() => selectSet(set.id)}
              onUpdate={updateSet}
              onComplete={completeSet}
            />
          ))}

          <div className="h-6" />
        </div>
      </div>

      {/* ── Sheets & Modals ─────────────────────────────────────────────────── */}
      <InfoSheet   open={openSheet === 'info'}   onClose={() => setOpenSheet(null)} exercise={exercise} />
      <WarmupSheet open={openSheet === 'warmup'} onClose={() => setOpenSheet(null)} exercise={exercise} warmupSets={warmupSets} />
      <SwapSheet   open={openSheet === 'swap'}   onClose={() => setOpenSheet(null)} variants={variants} />
      <NotesSheet  open={openSheet === 'notes'}  onClose={() => setOpenSheet(null)} />

      <SummaryModal
        open={showSummary}
        summary={summary}
        exerciseName={exercise.name}
        totalSets={initialSets.length}
        onClose={() => { setShowSummary(false); navigate(-1) }}
      />
    </div>
  )
}
