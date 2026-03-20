import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const clamp01 = (value) => Math.min(1, Math.max(0, value))

const getProgressRatio = ({ value, defaultValue, min = 0, max = 100 }) => {
  const values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : []

  const first = Number(values[0])
  const rangeMin = Number(min)
  const rangeMax = Number(max)

  if (!Number.isFinite(first) || !Number.isFinite(rangeMin) || !Number.isFinite(rangeMax) || rangeMax <= rangeMin) {
    return 0
  }

  return clamp01((first - rangeMin) / (rangeMax - rangeMin))
}

const Slider = React.forwardRef(({ className, value, defaultValue, min = 0, max = 100, colorScale = "asc", ...props }, ref) => {
  const progressRatio = getProgressRatio({ value, defaultValue, min, max })
  const safeRatio = Math.max(progressRatio, 0.0001)
  const gradient =
    colorScale === "desc"
      ? "linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #22c55e 100%)"
      : "linear-gradient(90deg, #22c55e 0%, #f59e0b 50%, #ef4444 100%)"

  const progressiveRangeStyle = {
    backgroundImage: gradient,
    backgroundSize: `${100 / safeRatio}% 100%`,
    backgroundPosition: "left center",
    backgroundRepeat: "no-repeat"
  }

  const thumbSource = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min]

  return (
    <SliderPrimitive.Root
      ref={ref}
      min={min}
      max={max}
      value={value}
      defaultValue={defaultValue}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range
          className="absolute h-full"
          style={progressiveRangeStyle}
        />
      </SliderPrimitive.Track>
      {thumbSource.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block h-5 w-5 rounded-full border-2 border-border bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
