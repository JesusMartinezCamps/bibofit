import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import FoodRestrictionsForm from '@/components/profile/FoodRestrictionsForm';
import { Loader2 } from 'lucide-react';

const DietRestrictionsStep = ({ onNext, isLoading }) => {
  const { user } = useAuth();
  const [saveStatus, setSaveStatus] = useState('idle');

  const handleNext = () => {
    onNext({});
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pr-1">
         <FoodRestrictionsForm userId={user?.id} onSaveStatusChange={setSaveStatus} />
      </div>

      <div className="pt-6 mt-auto shrink-0">
        <Button 
            onClick={handleNext} 
            disabled={isLoading || saveStatus === 'saving'}
            className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
        >
            {isLoading || saveStatus === 'saving' ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2"/> Guardando...</>
            ) : 'Siguiente'}
        </Button>
      </div>
    </div>
  );
};

export default DietRestrictionsStep;