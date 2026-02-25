import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Flame, Activity } from 'lucide-react';
import { formatApproximateValue } from '@/lib/metabolismCalculator';

const MetabolismCard = ({ ger, tdee, className }) => {
  const tooltipText = "Valor aproximado, tu gasto real es imposible de calcular, ¡tómalo como una referencia!";

  return (
    <Card className={`bg-[#1a1e23] border-gray-700 text-white ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center text-xl font-bold">
          <Flame className="mr-3 h-6 w-6 text-orange-500" />
          <span className="pb-1 border-b-2 border-orange-500">
            Gasto Energético
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-gray-800/50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Flame className="h-5 w-5 text-orange-400 mr-2" />
              <span className="text-sm font-medium text-gray-300">
                Gasto energético en reposo (GER):
              </span>
            </div>
            <div className="relative group">
              <span className="text-lg font-bold text-orange-400 cursor-help">
                {formatApproximateValue(ger)} kcal
              </span>
              {ger && (
                <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  {tooltipText}
                  <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Activity className="h-5 w-5 text-green-400 mr-2" />
              <span className="text-sm font-medium text-gray-300">
                Gasto diario total (TDEE):
              </span>
            </div>
            <div className="relative group">
              <span className="text-lg font-bold text-green-400 cursor-help">
                {formatApproximateValue(tdee)} kcal
              </span>
              {tdee && (
                <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  {tooltipText}
                  <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {!ger && (
          <div className="bg-yellow-900/20 border border-yellow-600/30 p-3 rounded-lg">
            <p className="text-yellow-400 text-sm">
              <strong>Faltan datos para calcular el metabolismo en reposo:</strong> peso, altura, fecha de nacimiento o sexo.
            </p>
          </div>
        )}

        {ger && !tdee && (
          <div className="bg-blue-900/20 border border-blue-600/30 p-3 rounded-lg">
            <p className="text-blue-400 text-sm">
              <strong>Selecciona tu nivel de actividad</strong> para calcular el gasto diario total.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MetabolismCard;