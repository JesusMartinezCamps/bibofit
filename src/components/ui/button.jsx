import { cn } from '@/lib/utils.js';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import React from 'react';

const buttonVariants = cva(
	'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary/90',
				diet: 'bg-green-500 text-white hover:bg-green-600 focus-visible:ring-green-500',
        training: 'bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500',
        'weight-log': 'bg-pink-600 text-white hover:bg-pink-700 focus-visible:ring-pink-600',
        'free-meal': 'bg-cyan-600 text-white hover:bg-cyan-700 focus-visible:ring-cyan-600',
        profile: 'bg-purple-600 text-white hover:bg-purple-700',
				destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
				outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        'outline-diet': 'border-2 border-green-500 bg-transparent text-green-400 hover:bg-green-500/20 hover:border-green-400 hover:text-green-300',
        'outline-training': 'border-2 border-red-500 bg-transparent text-red-400 hover:bg-red-500/20 hover:border-red-400 hover:text-red-300',
        'outline-weight': 'border-2 border-purple-500 bg-transparent text-purple-400 hover:bg-purple-500/20 hover:border-purple-400 hover:text-purple-300',
        'outline-profile': 'border-2 border-indigo-500 bg-transparent text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-400 hover:text-indigo-300',
        'outline-reminder': 'border-2 border-amber-400 bg-transparent text-amber-400 hover:bg-amber-500/20 hover:border-amber-400 hover:text-amber-300',
        'outline-yellow': 'border-2 border-yellow-500 bg-transparent text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-400 hover:text-yellow-300',
        'outline-lilac': 'border-2 border-violet-500 bg-transparent text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 hover:text-violet-300',
        'outline-dark': 'border border-input bg-slate-900/70 hover:bg-slate-800',
				secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
				ghost: 'hover:bg-accent hover:text-accent-foreground',
				link: 'text-primary underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-10 px-4 py-2',
				sm: 'h-9 rounded-md px-3',
				lg: 'h-11 rounded-md px-8',
				icon: 'h-10 w-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
	const Comp = asChild ? Slot : 'button';
	return (
		<Comp
			className={cn(buttonVariants({ variant, size, className }))}
			ref={ref}
            type={type}
			{...props}
		/>
	);
});
Button.displayName = 'Button';

export { Button, buttonVariants };