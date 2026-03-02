import React from 'react';
import { cn } from '@/lib/utils';

export const RECIPE_PANEL_CLASS = 'bg-card/75 border border-border rounded-md backdrop-blur-[1px]';

export const RecipeCardPanel = ({ className, children }) => {
  return <div className={cn(RECIPE_PANEL_CLASS, className)}>{children}</div>;
};

export const RecipeCardBackground = ({
  className,
  backgroundStyle,
  overlayClassName,
  gradientClassName,
  gradientStyle,
  children,
  onClick,
}) => {
  return (
    <div className={className} onClick={onClick}>
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-300 ease-in-out group-hover:scale-105"
        style={backgroundStyle}
      />
      {overlayClassName && <div className={cn('absolute inset-0 pointer-events-none', overlayClassName)} />}
      {(gradientClassName || gradientStyle) && (
        <div
          className={cn('absolute inset-0 pointer-events-none', gradientClassName)}
          style={gradientStyle}
        />
      )}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};
