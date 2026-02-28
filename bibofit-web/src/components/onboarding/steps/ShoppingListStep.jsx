import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const ShoppingListStep = ({ onNext, isLoading }) => {
  const handleNext = () => {
    onNext({});
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pr-1 space-y-6">
        <div className="text-center space-y-2 mb-8">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-gray-400">Hemos generado una lista preliminar basada en tu plan.</p>
        </div>

        <div className="space-y-3">
             <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-gray-200">Pechuga de Pollo (2kg)</span>
                </CardContent>
             </Card>
             <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-gray-200">Arroz Integral (1kg)</span>
                </CardContent>
             </Card>
             <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-gray-200">Aguacates (4 ud)</span>
                </CardContent>
             </Card>
             <p className="text-center text-sm text-gray-500 mt-4 italic">
                ...y 12 artículos más. Podrás ver la lista completa al finalizar.
             </p>
        </div>
      </div>

      <div className="pt-6 mt-auto shrink-0">
        <Button 
            onClick={handleNext} 
            disabled={isLoading}
            className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
        >
            {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2"/> Guardando...</>
            ) : 'Finalizar y Ver Todo'}
        </Button>
      </div>
    </div>
  );
};

export default ShoppingListStep;