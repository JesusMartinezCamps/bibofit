import React from 'react'
import { cn } from '@/lib/utils'

export const DEFAULT_RIR_OPTIONS = [
  {
    value: null,
    label: '—',
    subtitle: 'libre',
    activeClasses: 'border-border bg-card/60 text-white',
    inactiveClasses: 'border-border bg-card/20 text-muted-foreground',
    labelColor: 'text-muted-foreground',
  },
  {
    value: 0,
    label: '0',
    subtitle: 'fallo',
    activeClasses: 'border-red-500 bg-red-500/15 text-white',
    inactiveClasses: 'border-red-500/25 bg-red-500/5 text-red-400',
    labelColor: 'text-red-400',
  },
  {
    value: 1,
    label: '1',
    subtitle: 'RIR 1',
    activeClasses: 'border-orange-500 bg-orange-500/15 text-white',
    inactiveClasses: 'border-orange-500/25 bg-orange-500/5 text-orange-400',
    labelColor: 'text-orange-400',
  },
  {
    value: 2,
    label: '2',
    subtitle: 'RIR 2',
    activeClasses: 'border-orange-400 bg-orange-400/15 text-white',
    inactiveClasses: 'border-orange-400/25 bg-orange-400/5 text-orange-300',
    labelColor: 'text-orange-300',
  },
  {
    value: 3,
    label: '3',
    subtitle: 'RIR 3',
    activeClasses: 'border-amber-400 bg-amber-400/15 text-white',
    inactiveClasses: 'border-amber-400/25 bg-amber-400/5 text-amber-300',
    labelColor: 'text-amber-300',
  },
  {
    value: 4,
    label: '4+',
    subtitle: 'RIR 4+',
    activeClasses: 'border-green-500 bg-green-500/15 text-white',
    inactiveClasses: 'border-green-500/25 bg-green-500/5 text-green-400',
    labelColor: 'text-green-400',
  },
]

export default function RirScaleSelector({
  value,
  onChange,
  options = DEFAULT_RIR_OPTIONS,
  className,
  compact = false,
  toggleToNull = false,
}) {
  return (
    <div className={cn('flex gap-2 justify-center flex-wrap', className)}>
      {options.map((opt) => {
        const isActive =
          (opt.value === null && value === null) ||
          (opt.value !== null && value === opt.value)

        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => {
              if (toggleToNull && isActive && opt.value !== null) onChange(null)
              else onChange(opt.value)
            }}
            className={cn(
              'flex flex-col items-center rounded-xl border transition-all',
              compact ? 'px-3 py-2 min-w-[52px]' : 'px-4 py-3 min-w-[56px]',
              isActive ? opt.activeClasses : opt.inactiveClasses
            )}
          >
            <span
              className={cn(
                compact ? 'text-base' : 'text-xl',
                'font-bold leading-none',
                isActive ? 'text-white' : opt.labelColor
              )}
            >
              {opt.label}
            </span>
            <span
              className={cn(
                'text-[9px] mt-1 leading-none text-center whitespace-nowrap',
                isActive ? 'text-white/70' : 'opacity-60'
              )}
            >
              {opt.subtitle}
            </span>
          </button>
        )
      })}
    </div>
  )
}
