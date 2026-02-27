
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertTriangle, Info, Clock } from 'lucide-react';

const ConflictSummary = ({ 
    autoCount, 
    pendingCount, 
    manualCount, 
    totalAnalyzedRecipes,
    onScrollToPending,
    onScrollToManual
}) => {
    const totalConflicts = autoCount + pendingCount + manualCount;
    const resolvedCount = autoCount; // Asumimos que los automáticos ya están listos
    const progress = totalConflicts > 0 ? (resolvedCount / totalConflicts) * 100 : 100;

    if (totalConflicts === 0) {
        return (
            <Card className="bg-green-900/10 border-green-500/20 mb-4">
                <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle2 className="text-green-500 w-6 h-6" />
                    <div>
                        <p className="text-green-400 font-medium">Recetas verificadas exitosamente</p>
                        <p className="text-sm text-green-500/70">No se detectaron conflictos con las restricciones del usuario.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-slate-900 border-slate-800 mb-6">
            <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-slate-200">Resolución de Conflictos</h3>
                    <span className="text-xs text-slate-400">{resolvedCount} de {totalConflicts} resueltos</span>
                </div>
                
                <Progress value={progress} className="h-2 bg-slate-800 mb-4" indicatorClassName="bg-green-500" />
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-slate-800/50 p-3 rounded-md border border-slate-700/50 flex flex-col items-center justify-center text-center">
                        <CheckCircle2 className="w-5 h-5 text-green-400 mb-1" />
                        <span className="text-2xl font-bold text-slate-100">{autoCount}</span>
                        <span className="text-xs text-slate-400">Automatizados</span>
                    </div>
                    
                    <button 
                        onClick={onScrollToPending}
                        disabled={pendingCount === 0}
                        className={`p-3 rounded-md border flex flex-col items-center justify-center text-center transition-colors ${pendingCount > 0 ? 'bg-amber-900/20 border-amber-500/30 hover:bg-amber-900/30 cursor-pointer' : 'bg-slate-800/50 border-slate-700/50 opacity-50 cursor-not-allowed'}`}
                    >
                        <Clock className={`w-5 h-5 mb-1 ${pendingCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
                        <span className="text-2xl font-bold text-slate-100">{pendingCount}</span>
                        <span className="text-xs text-slate-400">Por confirmar</span>
                    </button>
                    
                    <button 
                        onClick={onScrollToManual}
                        disabled={manualCount === 0}
                        className={`p-3 rounded-md border flex flex-col items-center justify-center text-center transition-colors ${manualCount > 0 ? 'bg-red-900/20 border-red-500/30 hover:bg-red-900/30 cursor-pointer' : 'bg-slate-800/50 border-slate-700/50 opacity-50 cursor-not-allowed'}`}
                    >
                        <AlertTriangle className={`w-5 h-5 mb-1 ${manualCount > 0 ? 'text-red-400' : 'text-slate-500'}`} />
                        <span className="text-2xl font-bold text-slate-100">{manualCount}</span>
                        <span className="text-xs text-slate-400">Revisión manual</span>
                    </button>
                </div>
            </CardContent>
        </Card>
    );
};

export default ConflictSummary;
