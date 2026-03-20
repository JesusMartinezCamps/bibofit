import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { User, Shield, Calendar, StickyNote, ShoppingCart, MessageSquare } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { useNotifications } from '@/contexts/NotificationsContext';
import AppIcon from '@/components/icons/AppIcon';
import {
  getDefaultAuthenticatedPath,
  getRoleDisplayName,
  isAdminRole,
  isCoachRole,
  isStaffRole,
} from '@/lib/roles';

const Header = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { hasPendingRequests, totalUnread } = useNotifications();

  const isAdmin = isAdminRole(user?.role);
  const isCoach = isCoachRole(user?.role);
  const isStaff = isStaffRole(user?.role);

  const getHomeLink = () => {
      if (isAdmin) return '/admin-panel/advisories';
      return getDefaultAuthenticatedPath(user?.role);
  }

  const getContentLink = () => {
      if (isAdmin) return '/admin-panel/content/nutrition';
      if (isCoach) return '/coach/content';
      return '/';
  }
  
  const getRemindersLink = () => {
       if (isAdmin) return '/admin-panel/reminders';
       if (isCoach) return '/coach/reminders';
       return '/';
  }

  const getCalendarLink = () => {
    if (isStaff) return '/dashboard';
    return '/plan';
  };

  const displayName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.full_name || user?.email || 'Usuario';
  const profileImageUrl = user?.avatar_url || null;

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="sticky top-0 z-50 flex-none border-b border-border bg-background/95 backdrop-blur"
    >
      <TooltipProvider>
        <div className="w-full px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link to={getHomeLink()} className="flex items-center">
                 <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/35 bg-primary/15">
                    <AppIcon className="h-6 w-6 text-primary" />
                 </div>
                 <span className="ml-3 hidden text-xl font-bold text-foreground sm:block">Bibofit</span>
              </Link>
              <nav className="ml-2 flex items-center space-x-1 rounded-lg bg-muted/70 p-1">
                {isStaff && (
                  <>
                    <Button asChild variant="ghost" className={cn("relative h-auto px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground", location.pathname.includes('/content') && 'bg-secondary text-secondary-foreground')}>
                      <Link to={getContentLink()} className="flex items-center space-x-2">
                        <Shield className="w-4 h-4" />
                        <span className="hidden sm:inline">Contenidos</span>
                        {hasPendingRequests && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                          </span>
                        )}
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" className={cn("h-auto px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground", location.pathname.includes('/reminders') && 'bg-secondary text-secondary-foreground')}>
                      <Link to={getRemindersLink()} className="flex items-center space-x-2">
                          <StickyNote className="w-4 h-4" />
                          <span className="hidden sm:inline">Recordatorios</span>
                      </Link>
                    </Button>
                  </>
                )}
              </nav>
            </div>

            <div className="ml-2 flex items-center gap-2 sm:gap-3">
              <div className="flex items-center space-x-2">
                {isStaff && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          location.pathname.startsWith(getCalendarLink()) && 'bg-secondary text-secondary-foreground'
                        )}
                      >
                        <Link to={getCalendarLink()}>
                          <Calendar className="w-5 h-5" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Calendario</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                      <Link to="/shopping-list">
                        <ShoppingCart className="w-5 h-5" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Lista de la Compra</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'relative text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        location.pathname.startsWith('/communication') && 'bg-secondary text-secondary-foreground'
                      )}
                    >
                      <Link to="/communication">
                        <MessageSquare className="w-5 h-5" />
                        {totalUnread > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {totalUnread > 9 ? '9+' : totalUnread}
                          </span>
                        )}
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Centro de Comunicaciones</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Link
                data-guide-target="header-profile-button"
                to="/profile"
                className={cn(
                  'flex max-w-[12rem] items-center gap-2 px-1 py-1 transition-opacity hover:opacity-85',
                  location.pathname.startsWith('/profile') && 'opacity-85'
                )}
              >
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt="Foto de perfil"
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isCoach ? 'border border-amber-500/30 bg-amber-500/20 text-amber-500' : 'bg-primary text-primary-foreground'}`}>
                    <User className="w-4 h-4" />
                  </div>
                )}
                <div className="hidden min-w-0 text-left sm:block">
                  <p className="truncate text-xs font-medium text-foreground sm:text-sm">
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
                    {getRoleDisplayName(user?.role)}
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </motion.header>
  );
};

export default Header;
