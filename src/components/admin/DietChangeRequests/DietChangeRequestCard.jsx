import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronsRight, Copy, Replace } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const DietChangeRequestCard = ({ request, onReview }) => {
  if (!request || !request.profile) {
    return (
      <Card className="bg-slate-800/50 border-gray-700/80 p-4 flex items-center justify-between flex-wrap gap-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
          <div>
            <div className="h-5 w-32 bg-gray-700 rounded mb-2"></div>
            <div className="h-4 w-48 bg-gray-700 rounded"></div>
          </div>
        </div>
        <div className="h-9 w-36 bg-gray-700 rounded"></div>
      </Card>
    );
  }

  const isDuplicateRequest = request.request_type === 'duplicate';
  const recipeName = request.diet_plan_recipe?.custom_name || request.diet_plan_recipe?.recipe?.name || request.private_recipe?.name || 'Receta sin nombre';

  return (
    <TooltipProvider>
      <Card className="bg-slate-800/50 border-gray-700/80 p-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Tooltip>
            <TooltipTrigger>
                {isDuplicateRequest ? (
                    <Copy className="w-10 h-10 text-blue-400 flex-shrink-0" />
                ) : (
                    <Replace className="w-10 h-10 text-purple-400 flex-shrink-0" />
                )}
            </TooltipTrigger>
            <TooltipContent>
                <p>{isDuplicateRequest ? 'Solicitud de Duplicado' : 'Solicitud de Reemplazo'}</p>
            </TooltipContent>
          </Tooltip>
          <div>
            <p className="font-bold text-white text-lg">{request.profile.full_name}</p>
            <p className="text-sm text-gray-300">
              Solicita <span className={`font-semibold ${isDuplicateRequest ? 'text-blue-400' : 'text-purple-400'}`}>
                {isDuplicateRequest ? 'Duplicado' : 'Reemplazo'}
              </span> de la receta: <span className="font-semibold text-green-400">{recipeName}</span>
            </p>
            <p className="text-xs text-gray-500">Solicitado el: {new Date(request.requested_at).toLocaleString()}</p>
          </div>
        </div>
        <Button onClick={() => onReview(request)} size="sm">
          Revisar Cambios <ChevronsRight className="ml-2 h-4 w-4" />
        </Button>
      </Card>
    </TooltipProvider>
  );
};

export default DietChangeRequestCard;