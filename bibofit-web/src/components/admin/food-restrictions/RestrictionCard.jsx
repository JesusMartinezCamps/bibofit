import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, CheckCircle, XCircle, PenLine as FilePenLine, Trophy } from 'lucide-react';
import InfoBlock from './InfoBlock';
import FoodsWithSensitivitySection from './FoodsWithSensitivitySection';
import FoodsForConditionSection from './FoodsForConditionSection';

const RestrictionCard = ({ item, onEdit, onDelete, color, type, onUpdateFoods }) => (
    <div 
        className="group p-4 rounded-lg bg-slate-800/60 hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition-all flex flex-col"
    >
        <div 
            onClick={() => onEdit(item)} 
            className="flex items-start justify-between w-full mb-4 cursor-pointer"
        >
            <p className={`font-bold text-xl ${color}`}>{item.name}</p>
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                className="text-red-500 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
            >
                <Trash2 className="w-4 h-4" />
            </Button>
        </div>
        <div className="space-y-3 w-full">
            {item.objective && (
                <InfoBlock>
                    <Badge variant="outline" className="text-yellow-300 border-yellow-500/50 bg-yellow-900/30 mb-2">
                        <Trophy className="w-4 h-4 mr-2" /> Objetivo
                    </Badge>
                    <p className="text-sm text-yellow-200/90">{item.objective}</p>
                </InfoBlock>
            )}
            
            {item.description && (
                <InfoBlock>
                    <Badge variant="outline" className="border-cyan-500/50 bg-cyan-900/30 text-cyan-300 mb-2">
                        <FilePenLine className="w-4 h-4 mr-2" /> Descripción
                    </Badge>
                    <p className="text-sm text-cyan-300/80">{item.description}</p>
                </InfoBlock>
            )}
            
            {item.recommendations && (
                <InfoBlock>
                    <Badge variant="outline" className="text-green-300 border-green-500/50 bg-green-900/30 mb-2">
                       <CheckCircle className="w-4 h-4 mr-2" /> Recomendado
                    </Badge>
                    <p className="text-sm text-green-300/80">{item.recommendations}</p>
                </InfoBlock>
            )}
            
            {type === 'medical_condition' && (
                <FoodsForConditionSection 
                    conditionId={item.id} 
                    foods={item.foods || []}
                    onUpdateFoods={onUpdateFoods} 
                    relationType="recommended" 
                />
            )}

            {item.to_avoid && (
                <InfoBlock>
                    <Badge variant="destructive" className="text-red-300 border-red-500/50 bg-red-900/30 mb-2">
                       <XCircle className="w-4 h-4 mr-2" /> A evitar
                    </Badge>
                    <p className="text-sm text-red-300/80">{item.to_avoid}</p>
                </InfoBlock>
            )}
            
            {type === 'medical_condition' && (
                <FoodsForConditionSection 
                    conditionId={item.id} 
                    foods={item.foods || []}
                    onUpdateFoods={onUpdateFoods} 
                    relationType="to_avoid" 
                />
            )}

            {type === 'sensitivity' && (
                <FoodsWithSensitivitySection sensitivity={item} onUpdateFoods={onUpdateFoods} />
            )}
        </div>
    </div>
);

export default RestrictionCard;