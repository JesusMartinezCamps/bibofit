import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Apple, Plus, Edit, Trash2, User, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const DietManagement = () => {
  const [diets, setDiets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadDiets = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('diet_plans').select('*, user:profiles(full_name)').eq('is_template', false);
      if (error) {
        toast({ title: "Error", description: "No se pudieron cargar las dietas.", variant: "destructive" });
      } else {
        const formattedDiets = data.map(d => ({ ...d, userName: d.user?.full_name, startDate: d.start_date, endDate: d.end_date }));
        setDiets(formattedDiets);
      }
      setLoading(false);
    };
    loadDiets();
  }, [toast]);

  const filteredDiets = diets.filter(diet =>
    diet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (diet.userName && diet.userName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addDiet = () => {
    toast({
      title: "Crear plan nutricional",
      description: "🚧 Esta funcionalidad aún no está implementada—¡pero no te preocupes! ¡Puedes solicitarla en tu próximo prompt! 🚀"
    });
  };

  const editDiet = (dietId) => {
    toast({
      title: "Editar plan nutricional",
      description: "🚧 Esta funcionalidad aún no está implementada—¡pero no te preocupes! ¡Puedes solicitarla en tu próximo prompt! 🚀"
    });
  };

  const deleteDiet = (dietId) => {
    toast({
      title: "Eliminar plan nutricional",
      description: "🚧 Esta funcionalidad aún no está implementada—¡pero no te preocupes! ¡Puedes solicitarla en tu próximo prompt! 🚀"
    });
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col md:flex-row md:items-center justify-between"
      >
        <div className="flex items-center space-x-3 mb-4 md:mb-0">
          <Apple className="w-8 h-8 text-[#5ebe7d]" />
          <h2 className="text-3xl font-bold text-white">Gestión de Planes de Clientes</h2>
        </div>
        <Button onClick={addDiet} className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Crear Plan Nutricional
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="glass-effect rounded-2xl p-6"
      >
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar planes por nombre o cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field w-full pr-10"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </motion.div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Cargando dietas...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDiets.map((diet, index) => (
            <motion.div
              key={diet.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
              className="glass-effect rounded-2xl p-6 card-hover"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{diet.name}</h3>
                  <div className="flex items-center space-x-2 text-gray-400">
                    <User className="w-4 h-4" />
                    <span className="text-sm">{diet.userName}</span>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  diet.is_active 
                    ? 'bg-green-500 bg-opacity-20 text-green-300'
                    : 'bg-gray-500 bg-opacity-20 text-gray-300'
                }`}>
                  {diet.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="mb-4"><p className="text-gray-400 text-sm">{new Date(diet.startDate).toLocaleDateString('es-ES')} - {new Date(diet.endDate).toLocaleDateString('es-ES')}</p></div>
              <div className="flex items-center space-x-2">
                <Button onClick={() => editDiet(diet.id)} size="sm" className="btn-secondary flex-1"><Edit className="w-4 h-4 mr-2" />Editar</Button>
                <Button onClick={() => deleteDiet(diet.id)} size="sm" variant="ghost" className="text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && filteredDiets.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="glass-effect rounded-2xl p-8 text-center"
        >
          <Apple className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No se encontraron planes nutricionales</p>
        </motion.div>
      )}
    </div>
  );
};

export default DietManagement;