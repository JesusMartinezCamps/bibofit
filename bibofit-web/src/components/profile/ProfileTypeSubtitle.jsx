import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Crown, Star, ShieldCheck, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeRole } from '@/lib/roles';

const ProfileTypeSubtitle = ({ role = 'free' }) => {
  const normalizedRole = normalizeRole(role);

  const typeConfig = {
    free: {
      label: 'Plan Gratuito',
      // Subtle gray/slate gradient
      className: 'bg-gradient-to-r from-slate-600/95 to-slate-500/30 text-gray-300 dark:text-gray-200 border-slate-400 hover:from-slate-500 hover:to-slate-400',
      icon: User,
    },
    'pro-nutrition': {
      label: 'Pro Nutrición',
      // Gold gradient for Premium/Client
      className: 'bg-gradient-to-r from-amber-600/95 to-yellow-500/30 text-black border-yellow-400 font-bold hover:from-amber-400 hover:to-yellow-400',
      icon: Crown,
    },
    'pro-workout': {
      label: 'Pro Entreno',
      className: 'bg-gradient-to-r from-orange-600/95 to-amber-500/30 text-black border-amber-300 font-bold hover:from-orange-500 hover:to-amber-400',
      icon: Crown,
    },
    'coach-nutrition': {
      label: 'Coach Nutrición',
      // Green gradient for Coach
      className: 'bg-gradient-to-r from-emerald-700/95 to-emerald-500/30 text-white border-emerald-100 hover:from-emerald-500 hover:to-emerald-400',
      icon: ShieldCheck,
    },
    'coach-workout': {
      label: 'Coach Entreno',
      className: 'bg-gradient-to-r from-cyan-700/95 to-sky-500/30 text-white border-cyan-100 hover:from-cyan-500 hover:to-sky-400',
      icon: ShieldCheck,
    },
    admin: {
      label: 'Administrador',
      // Red/Rose gradient for Admin
      className: 'bg-gradient-to-r from-violet-700/95 to-purple-500/30 text-white border-violet-500 hover:from-violet-500 hover:to-purple-500',
      icon: Star,
    }
  };

  // Fallback to free if role doesn't match
  const config = typeConfig[normalizedRole] || typeConfig.free;
  const Icon = config.icon;

  return (
    <Link to="/pricing">
      <div className="flex flex-col items-center gap-2 mt-2 cursor-pointer transition-transform hover:scale-105 active:scale-95 group">
        <Badge variant="outline" className={cn("px-4 py-1.5 flex items-center gap-2 text-sm shadow-lg border", config.className)}>
          <Icon className="w-4 h-4" />
          {config.label}
          {normalizedRole === 'free' && (
           <span className="text-xs dark:text-yellow-300 text-yellow-600 hover:text-yellow-300 opacity-80 group-hover:opacity-100 transition-opacity">
              Actualizar Plan →
           </span>
        )}
        </Badge>
        
      </div>
    </Link>
  );
};

export default ProfileTypeSubtitle;
