import React, { useState, useCallback, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ProfileView from '@/components/profile/ProfileView';
import PersonalDataForm from '@/components/profile/PersonalDataForm';
import DietPreferencesForm from '@/components/profile/DietPreferencesForm';
import TrainingPreferencesForm from '@/components/profile/TrainingPreferencesForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

const ClientProfilePage = () => {
  const { userId } = useParams();
  const { toast } = useToast();
  const [clientName, setClientName] = useState('');
  const [viewMode, setViewMode] = useState('view');
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    const fetchClientName = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', userId)
        .single();
      if (data) {
        setClientName(data.full_name);
      }
    };
    fetchClientName();
  }, [userId]);

  const handleUpdate = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    setHasUnsavedChanges(true);
  }, []);

  const handleViewModeChange = (newMode) => {
    if (viewMode === 'edit' && newMode === 'view' && hasUnsavedChanges) {
      toast({
        title: "Perfil Actualizado",
        description: "Los datos del cliente se han guardado correctamente.",
      });
      setHasUnsavedChanges(false);
    }
    setViewMode(newMode);
  };

  return (
    <>
      <main className="w-full px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <Link to="/admin-panel/advisories" className="inline-flex items-center text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Asesorías
            </Link>
            <div className="flex items-center space-x-4">
              {/* Removed Diet and Workout Management Buttons here */}

              {/* Updated View/Edit buttons for all screen sizes */}
              <div className="flex items-center space-x-2 p-1 bg-gray-800/50 rounded-lg">
                <Button
                  onClick={() => handleViewModeChange('view')}
                  variant={viewMode === 'view' ? 'profile' : 'ghost'}
                  size="sm"
                  className={cn("flex items-center", viewMode !== 'view' && 'text-gray-400')}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Vista
                </Button>
                <Button
                  onClick={() => handleViewModeChange('edit')}
                  variant={viewMode === 'edit' ? 'profile' : 'ghost'}
                  size="sm"
                  className={cn("flex items-center", viewMode !== 'edit' && 'text-gray-400')}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              </div>
            </div>
          </div>
          
          {/* Removed AdminClientMobileActions (+Receta, +Peso, +C. Libre) here */}

          {viewMode === 'view' ? (
            <ProfileView userId={userId} isAdminView={true} refreshKey={refreshKey} />
          ) : (
            <Tabs defaultValue="personal" className="w-full mt-8">
              <TabsList className="grid w-full grid-cols-3 bg-[#282d34] rounded-lg p-1">
                <TabsTrigger value="personal" className="data-[state=active]:bg-[#983F5F] data-[state=active]:text-white rounded-md">Personal</TabsTrigger>
                <TabsTrigger value="diet" className="data-[state=active]:bg-[#5ebe7d] data-[state=active]:text-white rounded-md">Dieta</TabsTrigger>
                <TabsTrigger value="training" className="data-[state=active]:bg-[#F44C40] data-[state=active]:text-white rounded-md">Entreno</TabsTrigger>
              </TabsList>
              <TabsContent value="personal" className="mt-6">
                <PersonalDataForm userId={userId} onSave={handleUpdate} />
              </TabsContent>
              <TabsContent value="diet" className="mt-6">
                <DietPreferencesForm userId={userId} onUpdate={handleUpdate} />
              </TabsContent>
              <TabsContent value="training" className="mt-6">
                <TrainingPreferencesForm userId={userId} onUpdate={handleUpdate} />
              </TabsContent>
            </Tabs>
          )}
        </motion.div>
      </main>
    </>
  );
};

export default ClientProfilePage;