import React, { useState, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Helmet } from 'react-helmet';
    import { useToast } from '@/components/ui/use-toast';
    import PersonalDataForm from '@/components/profile/PersonalDataForm';
    import DietPreferencesForm from '@/components/profile/DietPreferencesForm';
    import TrainingPreferencesForm from '@/components/profile/TrainingPreferencesForm';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { cn } from '@/lib/utils'; // Import cn utility

    const ProfileDataPage = () => {
      const { toast } = useToast();
      const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

      const handleUpdate = useCallback(() => {
        if (!hasUnsavedChanges) {
          toast({
            title: "Cambios Guardados",
            description: "Tus datos se han actualizado correctamente.",
          });
        }
        setHasUnsavedChanges(true);
      }, [hasUnsavedChanges, toast]);

      return (
        <>
          <Helmet>
            <title>Mis Datos - Gsus Martz</title>
            <meta name="description" content="Edita tus datos personales, preferencias de dieta y de entrenamiento." />
          </Helmet>

          <main className="w-full py-8"> {/* Removed px-4 from main container */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="px-0 sm:px-4" // Added responsive padding to the content wrapper
            >
              <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-white">Mis Datos de Perfil</h1>
                <p className="text-gray-400 mt-2">Aquí puedes editar toda tu información.</p>
              </div>

              <Tabs defaultValue="personal" className="w-full max-w-4xl mx-auto">
                <TabsList className="grid w-full grid-cols-3 bg-[#282d34] rounded-lg p-1">
                  <TabsTrigger value="personal" className="data-[state=active]:bg-[#983F5F] data-[state=active]:text-white rounded-md">Personal</TabsTrigger>
                  <TabsTrigger value="diet" className="data-[state=active]:bg-[#5ebe7d] data-[state=active]:text-white rounded-md">Dieta</TabsTrigger>
                  <TabsTrigger value="training" className="data-[state=active]:bg-[#F44C40] data-[state=active]:text-white rounded-md">Entreno</TabsTrigger>
                </TabsList>
                <TabsContent value="personal" className="mt-6">
                  <PersonalDataForm onSave={handleUpdate} />
                </TabsContent>
                <TabsContent value="diet" className="mt-6">
                  <DietPreferencesForm onUpdate={handleUpdate} />
                </TabsContent>
                <TabsContent value="training" className="mt-6">
                  <TrainingPreferencesForm onUpdate={handleUpdate} />
                </TabsContent>
              </Tabs>
            </motion.div>
          </main>
        </>
      );
    };

    export default ProfileDataPage;