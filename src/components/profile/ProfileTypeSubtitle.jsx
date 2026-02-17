import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Crown, Star, ShieldCheck, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const ProfileTypeSubtitle = ({ role = 'free' }) => {
  // Normalize role to lowercase to ensure matching
  const normalizedRole = role ? role.toLowerCase() : 'free';

  const typeConfig = {
    free: {
      label: 'Plan Gratuito',
      // Subtle gray/slate gradient
      className: 'bg-gradient-to-r from-slate-600/95 to-slate-500/30 text-white border-slate-400 hover:from-slate-500 hover:to-slate-400',
      icon: User,
    },
    client: {
      label: 'Pro',
      // Gold gradient for Premium/Client
      className: 'bg-gradient-to-r from-amber-600/95 to-yellow-500/30 text-black border-yellow-400 font-bold hover:from-amber-400 hover:to-yellow-400',
      icon: Crown,
    },
    coach: {
      label: 'Entrenador',
      // Green gradient for Coach
      className: 'bg-gradient-to-r from-emerald-700/95 to-emerald-500/30 text-white border-emerald-400 hover:from-emerald-500 hover:to-emerald-400',
      icon: ShieldCheck,
    },
    admin: {
      label: 'Administrador',
      // Red/Rose gradient for Admin
      className: 'bg-gradient-to-r from-red-700/95 to-rose-600/30 text-white border-red-500 hover:from-red-500 hover:to-rose-500',
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
        </Badge>
        {normalizedRole === 'free' && (
           <span className="text-xs text-green-400 hover:text-green-300 opacity-80 group-hover:opacity-100 transition-opacity">
              Actualizar Plan →
           </span>
        )}
      </div>
    </Link>
  );
};

export default ProfileTypeSubtitle;