import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { User, Shield, Calendar, BookOpen, StickyNote, ShoppingCart } from 'lucide-react'; 
import { Link, useLocation } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { useNotifications } from '@/contexts/NotificationsContext';

const Header = ({ onShoppingListClick }) => {
  const { user } = useAuth();
  const location = useLocation();
  const { hasPendingRequests } = useNotifications();

  const isAdmin = user?.role === 'admin';
  const isCoach = user?.role === 'coach';
  const isStaff = isAdmin || isCoach;

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'coach':
        return 'Coach';
      case 'client':
        return 'Cliente';
      default:
        return 'Cliente';
    }
  };

  const getHomeLink = () => {
      if (isAdmin) return '/admin-panel/advisories';
      if (isCoach) return '/coach-dashboard';
      return '/dashboard';
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

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-[#1a1e23] border-b border-gray-700 sticky top-0 z-50"
    >
      <TooltipProvider>
        <div className="w-full px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link to={getHomeLink()} className="flex items-center">
                 <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center border border-green-500/30">
                    <Calendar className="w-6 h-6 text-green-400" />
                 </div>
              </Link>
              <nav className="flex items-center space-x-1 bg-gray-800/50 p-1 rounded-lg">
                {isStaff && (
                  <>
                    <Button asChild variant="ghost" className={cn("text-gray-300 hover:bg-gray-700 hover:text-white h-auto py-1.5 px-3 relative", location.pathname.includes('/content') && 'bg-gray-700 text-white')}>
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
                    <Button asChild variant="ghost" className={cn("text-gray-300 hover:bg-gray-700 hover:text-white h-auto py-1.5 px-3", location.pathname.includes('/reminders') && 'bg-gray-700 text-white')}>
                      <Link to={getRemindersLink()} className="flex items-center space-x-2">
                          <StickyNote className="w-4 h-4" />
                          <span className="hidden sm:inline">Recordatorios</span>
                      </Link>
                    </Button>
                  </>
                )}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCoach ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-[#5ebe7d] text-white'}`}>
                  <User className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">
                    {user?.full_name || user?.email || 'Usuario'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {getRoleDisplayName(user?.role)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {isStaff ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'text-gray-400 hover:text-white hover:bg-gray-700',
                          location.pathname.startsWith(getCalendarLink()) && 'text-gray-400'
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
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button asChild variant="ghost" size="icon" className={cn("text-gray-400 hover:text-white hover:bg-gray-700", location.pathname.includes('/plan') && 'bg-gray-700 text-white')}>
                        <Link to="/plan">
                          <BookOpen className="w-5 h-5" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Mi Plan</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-700" onClick={onShoppingListClick}>
                      <ShoppingCart className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Lista de la Compra</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-700">
                      <Link to="/profile">
                        <User className="w-5 h-5" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Mi Perfil</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </motion.header>
  );
};

export default Header;