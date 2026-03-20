
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate, Link } from 'react-router-dom';
import { User, GitBranch, LogOut, ChevronRight, LineChart, CalendarCheck, RotateCcw, BookOpen, Moon, Sun, Settings2 } from 'lucide-react';
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
import { useContextualGuide } from '@/contexts/ContextualGuideContext';
import { GUIDE_BLOCK_IDS } from '@/config/guideBlocks';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useTheme } from '@/contexts/ThemeContext';

const ProfilePage = () => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { openHelpCenter, triggerBlock } = useContextualGuide();

  useEffect(() => {
    triggerBlock(GUIDE_BLOCK_IDS.WELCOME);
  }, [triggerBlock]);
  const { startRepeatOnboarding } = useOnboarding();
  const { isDark, toggleTheme } = useTheme();
  const profileName = (`${user?.first_name || ''} ${user?.last_name || ''}`).trim() || user?.full_name?.trim();
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

  const menuGroups = [
    [
      {
        label: 'Mis Datos de Perfil',
        href: '/profile/data',
        icon: User,
        color: 'bg-gradient-to-r from-violet-700 to-violet-500 hover:from-violet-600 hover:to-fuchsia-500',
      },
    ],
    [
      {
        label: 'Configurar dieta',
        href: '/my-plan',
        icon: CalendarCheck,
        color: 'bg-gradient-to-r from-emerald-700 to-emerald-500 hover:from-emerald-600 hover:to-emerald-400',
      },
      {
        label: 'Configurar entreno',
        href: '/plan/entreno/rutina/nueva',
        icon: Settings2,
        color: 'bg-gradient-to-r from-red-700 to-rose-500 hover:from-red-600 hover:to-red-400',
      },
    ],
    [
      {
        label: 'Historial de Peso',
        href: '/profile/weight-history',
        icon: LineChart,
        color: 'bg-gradient-to-r from-purple-700 to-violet-500 hover:from-purple-600 hover:to-violet-400',
      },
      {
        label: 'Mis Variantes de Recetas',
        href: '/profile/variantes-recetas',
        icon: GitBranch,
        color: 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-cyan-400',
      },
    ],
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
            <div className="flex items-center justify-between gap-2 md:hidden -mt-2">
              <Button
                type="button"
                variant="outline"
                className="border-border bg-card text-foreground hover:bg-accent"
                onClick={openHelpCenter}
              >
                <BookOpen className="mr-2 h-4 w-4" /> Centro de Ayuda
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
            <h1 className="hidden text-5xl font-bold text-foreground md:block">{profileTitle}</h1>

            <div className="mt-3 hidden items-center justify-between gap-3 md:flex">
              <Button
                type="button"
                variant="outline"
                className="border-border bg-card text-foreground hover:bg-accent"
                onClick={openHelpCenter}
              >
                <BookOpen className="mr-2 h-4 w-4" /> Centro de Ayuda
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

            <div className="mt-2 flex justify-center md:justify-start">
              <ProfileTypeSubtitle role={user?.role} />
            </div>
            {user?.role === 'admin' && (
              <div className="flex flex-col items-center justify-center gap-2 mt-4">
                <Button
                    variant="link"
                    className="h-auto py-1 text-xs text-muted-foreground hover:text-primary"
                    onClick={handleResetOnboarding}
                >
                    <RotateCcw className="w-3 h-3 mr-1" /> Repetir Onboarding
                </Button>
              </div>
            )}
          </div>

          <div className="mb-12">
            {menuGroups.map((group, groupIndex) => (
              <div key={groupIndex}>
                {groupIndex > 0 && (
                  <div className="my-4 border-t border-border/40" />
                )}
                <div className="space-y-4">
                  {group.map((item, itemIndex) => {
                    const globalIndex = menuGroups.slice(0, groupIndex).reduce((acc, g) => acc + g.length, 0) + itemIndex;
                    return (
                      <motion.div
                        key={item.href}
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 * globalIndex }}
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
                    );
                  })}
                </div>
              </div>
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
    </>
  );
};

export default ProfilePage;
