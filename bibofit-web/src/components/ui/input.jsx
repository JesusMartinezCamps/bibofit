import * as React from "react"

    import { cn } from "@/lib/utils"

    const Input = React.forwardRef(({ className, type, ...props }, ref) => {
      return (
        (<input
          type={type}
          className={cn(
            "flex min-h-[48px] w-full rounded-xl border border-slate-600/80 bg-slate-800/70 px-4 py-3 text-white placeholder:text-gray-400 transition-all duration-200 hover:border-slate-400 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50",
            "number-input",
            className
          )}
          ref={ref}
          {...props} />)
      );
    })
    Input.displayName = "Input"

    const InputWithUnit = React.forwardRef(({ className, unit, unitClassName, containerClassName, ...props }, ref) => {
      return (
        <div className={cn("relative flex items-center w-full", containerClassName)}>
          <Input
            className={cn("pr-8", className)}
            ref={ref}
            {...props}
          />
          <span className={cn("absolute right-2.5 text-sm text-gray-400 pointer-events-none", unitClassName)}>
            {unit}
          </span>
        </div>
      );
    });
    InputWithUnit.displayName = "InputWithUnit";

    export { Input, InputWithUnit }
