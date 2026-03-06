
import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate, Link } from 'react-router-dom';
import { User,GitBranch, LogOut, ChevronRight, LineChart, CalendarCheck, RotateCcw, PlayCircle, Bell, Moon, Sun } from 'lucide-react'; 
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
import { useTheme } from '@/contexts/ThemeContext';

const ProfilePage = () => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { openGuide } = useQuickStartGuide();
  const { startRepeatOnboarding } = useOnboarding();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { isDark, toggleTheme } = useTheme();
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const profileName = (`${user?.first_name || ''} ${user?.last_name || ''}`).trim() || user?.full_name?.trim();
  const profileTitle = profileName ? profileName : 'Mi Perfil';
  const hasUnreadNotifications = unreadCount > 0;

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
      color: 'bg-gradient-to-r from-violet-700 to-violet-500 hover:from-violet-600 hover:to-fuchsia-500',
    },
    {
      label: 'Historial de Peso',
      href: '/profile/weight-history',
      icon: LineChart,
      color: 'bg-gradient-to-r from-emerald-700 to-green-600 hover:from-emerald-600 hover:to-green-500',
    },
    {
      label: 'Mis Variantes de Recetas',
      href: '/profile/variantes-recetas',
      icon: GitBranch,
      color: 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-cyan-400',
    },
     {
      label: 'Mi Dieta',
      href: '/my-plan',
      icon: CalendarCheck,
      color: 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400',
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
            <div className="flex items-center justify-end gap-2 md:hidden -mt-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="relative border-border bg-card text-foreground hover:bg-accent"
                onClick={() => setIsNotificationsOpen(true)}
                aria-label="Abrir notificaciones"
              >
                <Bell className="h-4 w-4" />
                {hasUnreadNotifications && (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-border bg-card text-foreground hover:bg-accent"
                onClick={toggleTheme}
                aria-label="Cambiar tema"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>

            <div className="mt-3 text-center md:hidden">
              <h1 className="text-4xl font-bold text-foreground">{profileTitle}</h1>
            </div>

            <div className="hidden items-start justify-between gap-3 md:flex">
              <h1 className="text-5xl font-bold text-foreground">{profileTitle}</h1>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="relative border-border bg-card text-foreground hover:bg-accent"
                  onClick={() => setIsNotificationsOpen(true)}
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Notificaciones
                  {hasUnreadNotifications && (
                    <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-border bg-card text-foreground hover:bg-accent"
                  onClick={toggleTheme}
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="mt-2 flex justify-center md:justify-start">
              <ProfileTypeSubtitle role={user?.role} />
            </div>
            <div className="flex flex-col items-center justify-center gap-2 mt-4">
              <Button 
                  variant="link" 
                  className="h-auto py-1 text-xs text-muted-foreground hover:text-primary" 
                  onClick={handleResetOnboarding}
              >
                  <RotateCcw className="w-3 h-3 mr-1" /> Repetir Onboarding
              </Button>
              <Button 
                  variant="link" 
                  className="h-auto py-1 text-xs text-muted-foreground hover:text-primary" 
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
                    className={`h-20 w-full justify-between px-6 text-lg text-white transition-all duration-300 ${item.color}`}
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
                  className="mx-auto flex w-full max-w-sm items-center gap-2 bg-red-600/90 text-white hover:bg-red-500"
                >
                  <LogOut className="w-5 h-5" />
                  Cerrar Sesión
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="w-[90vw] max-w-md md:w-full">
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción cerrará tu sesión actual. Podrás volver a iniciar sesión en cualquier momento.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle>Historial de Notificaciones</DialogTitle>
                <DialogDescription>
                  Aquí puedes revisar todas tus notificaciones recientes.
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={markAllAsRead}
                disabled={!notifications?.some((n) => !n.is_read)}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                Marcar todas
              </Button>
            </div>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-2">
            {!notifications || notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
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
                      ? 'border-border bg-muted/70'
                      : 'border-primary/50 bg-primary/10 hover:bg-primary/15'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    {!n.is_read && (
                      <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground/80">
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
