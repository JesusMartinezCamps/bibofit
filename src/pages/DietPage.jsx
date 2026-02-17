import React, { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Apple, ArrowLeft, Dot, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import WeightLogDialog from '@/components/shared/WeightLogDialog';

const mockRecipes = [
  { id: 1, name: 'Desayuno: Tostadas con aguacate y huevo', ingredients: [{ name: 'Pan integral', quantity: '2 rebanadas' }, { name: 'Aguacate', quantity: '1/2 unidad' }, { name: 'Huevo', quantity: '1' }] },
  { id: 2, name: 'Almuerzo: Pechuga de pollo a la plancha con quinoa y brócoli', ingredients: [{ name: 'Pechuga de pollo', quantity: '150g' }, { name: 'Quinoa', quantity: '80g (en crudo)' }, { name: 'Brócoli', quantity: '1 taza' }] },
  { id: 3, name: 'Cena: Salmón al horno con espárragos', ingredients: [{ name: 'Lomo de salmón', quantity: '180g' }, { name: 'Espárragos trigueros', quantity: '1 manojo' }, { name: 'Limón', quantity: '1/2 unidad' }] },
];

const DietPage = () => {
  const { date } = useParams();
  const [isWeightLogOpen, setIsWeightLogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleLogAdded = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const formattedDate = date ? new Date(date).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : '';

  return (
    <>
      <Helmet>
        <title>{`Plan de Dieta - ${formattedDate} - Gsus Martz`}</title>
        <meta name="description" content={`Tu plan de nutrición para el día ${formattedDate}`} />
      </Helmet>

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link to="/dashboard" className="inline-flex items-center text-gray-400 hover:text-white mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al calendario
          </Link>
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-[#5ebe7d] rounded-lg flex items-center justify-center">
                <Apple className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white">Plan de Dieta</h1>
                <p className="text-lg text-[#5ebe7d]">{formattedDate}</p>
              </div>
            </div>
            <Button 
              variant="diet"
              onClick={() => setIsWeightLogOpen(true)}
            >
              <Scale className="mr-2 h-4 w-4" />
              Registrar Peso
            </Button>
          </div>
        </motion.div>

        <div className="space-y-8">
          {mockRecipes.map((recipe, index) => (
            <motion.div
              key={recipe.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-effect rounded-2xl p-6 card-hover"
            >
              <h2 className="text-2xl font-bold text-white mb-4">{recipe.name}</h2>
              <ul className="space-y-2">
                {recipe.ingredients.map((ingredient, i) => (
                  <li key={i} className="flex items-center text-gray-300">
                    <Dot className="text-[#5ebe7d] mr-2 flex-shrink-0" />
                    <span className="font-semibold mr-2">{ingredient.name}:</span>
                    <span>{ingredient.quantity}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </main>
      <WeightLogDialog 
        open={isWeightLogOpen} 
        onOpenChange={setIsWeightLogOpen} 
        onLogAdded={handleLogAdded}
        initialDate={date}
      />
    </>
  );
};

export default DietPage;