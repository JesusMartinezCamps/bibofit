
import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate, Link } from 'react-router-dom';
import { User, Utensils, LogOut, ChevronRight, LineChart, CalendarCheck, RotateCcw, PlayCircle } from 'lucide-react'; 
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
import ProfileTypeSubtitle from '@/components/profile/ProfileTypeSubtitle';
import { useQuickStartGuide } from '@/contexts/QuickStartGuideContext';
import { useOnboarding } from '@/hooks/useOnboarding';

const ProfilePage = () => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { openGuide } = useQuickStartGuide();
  const { startRepeatOnboarding } = useOnboarding();
  const profileName = user?.full_name?.trim();
  const profileTitle = profileName ? profileName : 'Mi Perfil';

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
    toast({
      title: "Sesión cerrada",
      description: "¡Hasta la próxima! Sigue superándote cada día.",
    });
  };
  
  const handleResetOnboarding = async () => {
      try {
          const started = await startRepeatOnboarding();
          if (started) {
            toast({ title: "Onboarding iniciado", description: "Puedes repetir, saltar al ajuste final o cerrar sin perder estabilidad." });
          }
      } catch (error) {
          console.error(error);
          toast({ title: "Error", description: "No se pudo iniciar la repetición del onboarding", variant: "destructive" });
      }
  };

  const menuItems = [
    {
      label: 'Mis Datos de Perfil',
      href: '/profile/data',
      icon: User,
      color: 'bg-gradient-to-r from-purple-900 to-fuchsia-700 hover:from-purple-700 hover:to-fuchsia-500',
    },
    {
      label: 'Historial de Peso',
      href: '/profile/weight-history',
      icon: LineChart,
      color: 'bg-gradient-to-r from-violet-900 to-violet-700 hover:from-violet-700 hover:to-violet-500',
    },
    {
      label: 'Mis Recetas Libres',
      href: '/profile/my-free-recipes',
      icon: Utensils,
      color: 'bg-gradient-to-r from-blue-900 to-indigo-700 hover:from-blue-700 hover:to-indigo-500',
    },
     {
      label: 'Mi Dieta',
      href: '/my-plan',
      icon: CalendarCheck,
      color: 'bg-gradient-to-r from-green-900 to-green-700 hover:from-green-700 hover:to-green-500',
    } 
  ];

  return (
    <>
      <Helmet>
        <title>{profileTitle} - Bibofit</title>
        <meta name="description" content="Gestiona tu información y consulta tus creaciones." />
      </Helmet>

      <main className="w-full px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-white">{profileTitle}</h1>
            <ProfileTypeSubtitle role={user?.role} />
            <div className="flex flex-col items-center justify-center gap-2 mt-4">
              <Button 
                  variant="link" 
                  className="text-gray-500 hover:text-green-400 text-xs h-auto py-1" 
                  onClick={handleResetOnboarding}
              >
                  <RotateCcw className="w-3 h-3 mr-1" /> Repetir Onboarding
              </Button>
              <Button 
                  variant="link" 
                  className="text-gray-500 hover:text-emerald-400 text-xs h-auto py-1" 
                  onClick={openGuide}
              >
                  <PlayCircle className="w-3 h-3 mr-1" /> Repetir Guía Rápida
              </Button>
            </div>
          </div>

          <div className="space-y-4 mb-12">
            {menuItems.map((item, index) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * index }}
              >
                <Link to={item.href}>
                  <Button
                    variant="secondary"
                    className={`w-full h-20 text-lg justify-between px-6 ${item.color} text-white transition-all duration-300`}
                  >
                    <div className="flex items-center">
                      <item.icon className="mr-4 h-6 w-6" />
                      {item.label}
                    </div>
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full max-w-sm mx-auto flex items-center gap-2 bg-red-800/80 hover:bg-red-700/90 text-white"
                >
                  <LogOut className="w-5 h-5" />
                  Cerrar Sesión
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="w-[90vw] md:w-full max-w-md bg-gray-900 border-gray-700 text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-400">
                    Esta acción cerrará tu sesión actual. Podrás volver a iniciar sesión en cualquier momento.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-100 border-gray-600 hover:bg-gray-600">Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout} className="bg-red-600 hover:bg-red-700">
                    Cerrar Sesión
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </motion.div>
        </motion.div>
      </main>
    </>
  );
};

export default ProfilePage;
