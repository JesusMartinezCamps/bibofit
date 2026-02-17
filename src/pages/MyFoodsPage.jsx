import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Loader2, Apple, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import TabNavigation from '@/components/admin/UserCreatedFoods/TabNavigation';
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
import { useToast } from '@/components/ui/use-toast';

const MyFoodsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allFoods, setAllFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  const fetchFoods = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_created_foods')
        .select('*, linked_food:linked_food_id(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllFoods(data);
    } catch (error) {
      console.error("Error fetching user created foods:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFoods();
  }, [fetchFoods]);

  const filteredFoods = useMemo(() => {
    if (activeTab === 'approved') {
        return allFoods.filter(food => food.status === 'approved_general' || food.status === 'approved_private');
    }
    return allFoods.filter(food => food.status === activeTab);
  }, [allFoods, activeTab]);

  const pendingCount = useMemo(() => {
    return allFoods.filter(food => food.status === 'pending').length;
  }, [allFoods]);
  
  const handleDeleteFood = async (foodId) => {
    try {
      const { error } = await supabase.from('user_created_foods').delete().eq('id', foodId);
      if (error) throw error;
      toast({ title: 'Éxito', description: 'Alimento eliminado permanentemente.' });
      fetchFoods(); // Refresh list
    } catch (error) {
      console.error("Error deleting food:", error);
      toast({ title: 'Error', description: `No se pudo eliminar el alimento: ${error.message}`, variant: 'destructive' });
    }
  };


  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">Pendiente</Badge>;
      case 'approved_general':
        return <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">Aprobado (General)</Badge>;
      case 'approved_private':
        return <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">Aprobado (Privado)</Badge>;
      default:
        return null; // Don't show badge for rejected or unknown statuses in this context
    }
  };

  const tabs = [
    { value: 'pending', label: 'Pendientes' },
    { value: 'approved', label: 'Aprobados' },
    { value: 'rejected', label: 'Rechazados' },
  ];

  return (
    <>
      <Helmet>
        <title>Mis Alimentos Creados - Gsus Martz</title>
        <meta name="description" content="Consulta el historial de tus alimentos creados y su estado." />
      </Helmet>
      <main className="w-full px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-white flex items-center justify-center gap-4">
              <Apple className="w-10 h-10 text-green-400" />
              Mis Alimentos Creados
            </h1>
            <p className="text-gray-400 mt-2">Aquí puedes ver el historial de los alimentos que has solicitado.</p>
          </div>

          <TabNavigation 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
            usersWithPending={[{ count: pendingCount }]}
            tabs={tabs}
          />

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-12 h-12 animate-spin text-green-500" />
            </div>
          ) : filteredFoods.length === 0 ? (
            <Card className="bg-gray-800/50 border-gray-700 text-center py-12">
              <CardContent>
                <p className="text-gray-400">No tienes alimentos en esta categoría.</p>
                {activeTab === 'pending' && <p className="text-gray-500 text-sm mt-2">Puedes solicitar un alimento nuevo desde "Mi Perfil".</p>}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredFoods.map((food, index) => (
                <motion.div
                  key={food.id}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 * index }}
                >
                  <Card className="bg-gray-800/50 border-gray-700 hover:border-green-500/50 transition-colors relative">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-white">{food.name}</CardTitle>
                        <CardDescription className="text-gray-400">
                          Solicitado el {format(new Date(food.created_at), 'dd MMMM, yyyy', { locale: es })}
                        </CardDescription>
                      </div>
                      {activeTab !== 'rejected' && getStatusBadge(food.status)}
                    </CardHeader>
                    {(activeTab === 'rejected' || activeTab === 'pending') && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="absolute top-2 right-2 p-1.5 bg-red-900/50 rounded-full text-red-400 hover:bg-red-800/70 hover:text-white transition-all">
                            <XCircle size={18} />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar permanentemente?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. El alimento "{food.name}" será eliminado para siempre.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteFood(food.id)} className="bg-red-600 hover:bg-red-700">
                              Sí, eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </>
  );
};

export default MyFoodsPage;