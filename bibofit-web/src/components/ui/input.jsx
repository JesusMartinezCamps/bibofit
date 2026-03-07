import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "number-input flex min-h-[48px] w-full rounded-xl border border-input bg-card px-4 py-3 text-foreground placeholder:text-gray-400 dark:placeholder:text-muted-foreground transition-all duration-200 hover:border-primary/50 hover:bg-card/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/35 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = "Input";

const InputWithUnit = React.forwardRef(({ className, unit, unitClassName, containerClassName, ...props }, ref) => {
  return (
    <div className={cn("relative flex w-full items-center", containerClassName)}>
      <Input
        className={cn("pr-8", className)}
        ref={ref}
        {...props}
      />
      <span className={cn("pointer-events-none absolute right-2.5 text-sm text-muted-foreground", unitClassName)}>
        {unit}
      </span>
    </div>
  );
});

InputWithUnit.displayName = "InputWithUnit";

export { Input, InputWithUnit };

