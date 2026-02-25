import React, { useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, Trash2, CheckCircle2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';

/**
 * CalorieAdjustmentHistory Component
 * 
 * Displays a list of historical calorie overrides.
 * This is a presentational component that receives data via props.
 * 
 * Data Flow:
 * - Parent (CalorieAdjustment) fetches data from `diet_plan_calorie_overrides`.
 * - Parent passes `overrides` array to this component.
 * - This component renders the list.
 */
const CalorieAdjustmentHistory = ({ 
    overrides = [], 
    loading = false, 
    onDelete, 
    readOnly = false 
}) => {
    
    // DEBUGGING: Log received props to verify data flow
    useEffect(() => {
        // Group logs to avoid clutter
        // Fixed: Use import.meta.env.DEV for Vite instead of process.env.NODE_ENV
        if (import.meta.env.DEV) {
            console.groupCollapsed('📊 [CalorieAdjustmentHistory] Update');
            console.log('Overrides Received:', overrides.length);
            console.log('Loading State:', loading);
            if (overrides.length > 0) {
                console.table(overrides.slice(0, 3)); // Log first 3 for inspection
            }
            console.groupEnd();
        }
    }, [overrides, loading]);

    // SORTING: Ensure latest is first (DESC order by created_at)
    // Even if DB query sorts, client-side sort adds safety.
    const sortedOverrides = [...overrides].sort((a, b) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateB - dateA;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-800 rounded-xl bg-gray-900/20">
                <Loader2 className="w-5 h-5 animate-spin text-green-500 mr-2" />
                <p className="text-gray-500 text-sm animate-pulse">Cargando historial...</p>
            </div>
        );
    }

    if (sortedOverrides.length === 0) {
        return (
            <div className="text-center py-8 border-2 border-dashed border-gray-800 rounded-xl bg-gray-900/20">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 mb-3">
                    <History className="h-5 w-5 text-gray-500" />
                </div>
                <h3 className="text-sm font-medium text-gray-400">Sin historial</h3>
                <p className="mt-1 text-xs text-gray-600">No hay ajustes manuales previos.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
            {sortedOverrides.map((override, index) => {
                // Since list is sorted by created_at DESC, index 0 is always the active/latest
                const isActive = index === 0;
                
                return (
                    <Card 
                        key={override.id} 
                        className={cn(
                            "border-gray-800 bg-gray-900/40 transition-all hover:bg-gray-900/60 group",
                            isActive && "border-green-500/30 bg-green-500/5 shadow-sm shadow-green-900/10"
                        )}
                    >
                        <CardContent className="p-3 pl-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center border shrink-0",
                                    isActive 
                                        ? "bg-green-500/10 border-green-500/30 text-green-500" 
                                        : "bg-gray-800 border-gray-700 text-gray-500"
                                )}>
                                    {isActive ? <CheckCircle2 className="w-4 h-4"/> : <History className="w-4 h-4"/>}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-lg font-bold text-white font-numeric">
                                            {override.manual_calories} <span className="text-xs font-normal text-gray-500">kcal</span>
                                        </span>
                                        {isActive && (
                                            <Badge className="bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20 h-5 px-1.5 text-[10px]">
                                                ✅ Vigente
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400 capitalize flex items-center gap-1">
                                        {override.created_at ? format(new Date(override.created_at), 'd MMM yyyy HH:mm', { locale: es }) : 'Reciente'}
                                    </p>
                                </div>
                            </div>

                            {!readOnly && onDelete && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="text-red-500 hover:text-red-400 hover:bg-red-950/30 transition-colors h-8 w-8"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="bg-gray-950 border-gray-800 text-white z-[9999]">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Eliminar este ajuste?</AlertDialogTitle>
                                            <AlertDialogDescription className="text-gray-400">
                                                {isActive 
                                                    ? "Estás a punto de eliminar el ajuste VIGENTE. El sistema recalculará usando el siguiente registro más reciente o el TDEE base."
                                                    : "Esta acción eliminará permanentemente este registro del historial."
                                                }
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel className="bg-gray-900 border-gray-800 text-white hover:bg-gray-800 hover:text-white">
                                                Cancelar
                                            </AlertDialogCancel>
                                            <AlertDialogAction 
                                                onClick={() => onDelete(override.id)} 
                                                className="bg-red-600 hover:bg-red-700 text-white border-0"
                                            >
                                                Eliminar
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};

// Internal component for loading spinner not imported from lucide-react in header (fix)
const Loader2 = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

export default CalorieAdjustmentHistory;