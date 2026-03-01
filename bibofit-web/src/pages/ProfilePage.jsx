
import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate, Link } from 'react-router-dom';
import { User, Utensils, LogOut, ChevronRight, LineChart, CalendarCheck, RotateCcw, PlayCircle, Bell } from 'lucide-react'; 
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import ProfileTypeSubtitle from '@/components/profile/ProfileTypeSubtitle';
import { useQuickStartGuide } from '@/contexts/QuickStartGuideContext';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useNotifications } from '@/contexts/NotificationsContext';

const ProfilePage = () => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { openGuide } = useQuickStartGuide();
  const { startRepeatOnboarding } = useOnboarding();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
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
          <div className="mb-10">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-4xl md:text-5xl font-bold text-white">{profileTitle}</h1>
              <Button
                type="button"
                variant="outline"
                className="relative border-gray-600 bg-slate-900/70 text-gray-100 hover:bg-slate-800"
                onClick={() => setIsNotificationsOpen(true)}
              >
                <Bell className="w-4 h-4 mr-2" />
                Notificaciones
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex min-w-[1.25rem] h-5 px-1 items-center justify-center rounded-full bg-red-500 text-white text-xs font-semibold">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>
            </div>
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

      <Dialog open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle>Historial de Notificaciones</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Aquí puedes revisar todas tus notificaciones recientes.
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={markAllAsRead}
                disabled={!notifications?.some((n) => !n.is_read)}
                className="bg-slate-700 hover:bg-slate-600 text-white"
              >
                Marcar todas
              </Button>
            </div>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-2">
            {!notifications || notifications.length === 0 ? (
              <div className="text-sm text-gray-400 py-8 text-center">
                No tienes notificaciones todavía.
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.is_read && markAsRead(n.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    n.is_read
                      ? 'border-slate-700 bg-slate-800/50'
                      : 'border-cyan-600/60 bg-cyan-900/20 hover:bg-cyan-900/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-sm text-white">{n.title}</p>
                    {!n.is_read && (
                      <span className="inline-flex w-2.5 h-2.5 mt-1 rounded-full bg-cyan-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-300 mt-1">{n.message}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(n.created_at).toLocaleString('es-ES')}
                  </p>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProfilePage;
