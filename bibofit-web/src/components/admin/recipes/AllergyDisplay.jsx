import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

const AllergyDisplay = ({ ingredients, allFoods }) => {
  const sensitivityData = useMemo(() => {
    const sensitivityMap = new Map();
    
    ingredients.forEach(ing => {
      if (!ing.food_id) return;
      
      const foodDetails = allFoods.find(f => f.id === parseInt(ing.food_id));
      if (!foodDetails || !foodDetails.sensitivityIds) return;
      
      foodDetails.sensitivityIds.forEach(sensitivityId => {
        if (!sensitivityMap.has(sensitivityId)) {
          sensitivityMap.set(sensitivityId, {
            id: sensitivityId,
            name: '',
            ingredients: []
          });
        }
        
        if (!sensitivityMap.get(sensitivityId).ingredients.some(i => i.name === foodDetails.name)) {
          sensitivityMap.get(sensitivityId).ingredients.push({
            name: foodDetails.name,
            id: foodDetails.id
          });
        }
      });
    });
    
    return Array.from(sensitivityMap.values());
  }, [ingredients, allFoods]);

  const [sensitivitiesWithNames, setSensitivitiesWithNames] = React.useState([]);

  React.useEffect(() => {
    const fetchSensitivityNames = async () => {
      if (sensitivityData.length === 0) {
        setSensitivitiesWithNames([]);
        return;
      }

      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const sensitivityIds = sensitivityData.map(a => a.id);
        
        const { data: sensitivities, error } = await supabase
          .from('sensitivities')
          .select('id, name')
          .in('id', sensitivityIds);

        if (error) throw error;

        const enrichedSensitivities = sensitivityData.map(sensitivityItem => {
          const sensitivityInfo = sensitivities.find(a => a.id === sensitivityItem.id);
          return {
            ...sensitivityItem,
            name: sensitivityInfo?.name || 'Desconocida'
          };
        }).sort((a, b) => a.name.localeCompare(b.name));

        setSensitivitiesWithNames(enrichedSensitivities);
      } catch (error) {
        console.error('Error fetching sensitivity names:', error);
        setSensitivitiesWithNames([]);
      }
    };

    fetchSensitivityNames();
  }, [sensitivityData]);

  if (sensitivitiesWithNames.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4 p-4 border border-orange-500/30 rounded-lg bg-orange-500/10"
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-orange-400" />
        <h5 className="text-sm font-semibold text-orange-400">
          Sensibilidades Detectadas en la Receta
        </h5>
      </div>
      
      <div className="space-y-3">
        <AnimatePresence>
          {sensitivitiesWithNames.map((sensitivity) => (
            <motion.div
              key={sensitivity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-orange-900/20 border border-orange-600/30 rounded-md p-3"
            >
              <div className="flex items-start gap-2">
                <span className="text-sm font-semibold text-orange-300 min-w-0 flex-shrink-0">
                  {sensitivity.name}:
                </span>
                <div className="flex flex-wrap gap-1 min-w-0">
                  {sensitivity.ingredients.map((ingredient, index) => (
                    <span
                      key={`${ingredient.id}-${index}`}
                      className="inline-block px-2 py-1 text-xs bg-orange-800/40 text-orange-200 rounded border border-orange-600/40"
                    >
                      {ingredient.name}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AllergyDisplay;