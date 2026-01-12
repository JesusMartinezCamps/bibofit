import * as React from "react"

    import { cn } from "@/lib/utils"

    const Input = React.forwardRef(({ className, type, ...props }, ref) => {
      return (
        (<input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-lg border border-gray-600/50 bg-gray-800/50 px-4 py-3 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3DB477] focus:border-transparent transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
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