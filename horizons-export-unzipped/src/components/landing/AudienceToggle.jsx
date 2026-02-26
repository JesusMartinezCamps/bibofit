import React from 'react';
import { motion } from 'framer-motion';
import { User, Briefcase } from 'lucide-react';

const AudienceToggle = ({ value, onChange, className = '' }) => {
  return (
    <div className={`flex justify-center ${className}`}>
      <div className="relative inline-flex items-center rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur">
        <motion.div
          layout
          className="absolute top-1 bottom-1 rounded-xl bg-white/10"
          style={{
            left: value === 'client' ? 0 : '50%',
            width: 'calc(50% - 8px)',
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        />

        <button
          type="button"
          onClick={() => onChange('client')}
          className={`relative z-10 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60 ${
            value === 'client' ? 'text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-pressed={value === 'client'}
        >
          <User className="h-4 w-4" />
          Soy cliente
        </button>

        <button
          type="button"
          onClick={() => onChange('coach')}
          className={`relative z-10 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60 ${
            value === 'coach' ? 'text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-pressed={value === 'coach'}
        >
          <Briefcase className="h-4 w-4" />
          Soy entrenador
        </button>
      </div>
    </div>
  );
};

export default AudienceToggle;
