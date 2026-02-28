import React from 'react';
import { motion } from 'framer-motion';

const DietAssignmentLoadingAnimation = () => {
  // Generate random particles
  const particles = Array.from({ length: 15 }).map((_, i) => ({
    id: i,
    size: Math.random() * 8 + 4,
    x: Math.random() * 100 - 50,
    y: Math.random() * 100 - 50,
    duration: Math.random() * 2 + 2,
    delay: Math.random() * 2
  }));

  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {/* Floating Particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-gradient-to-tr from-green-400 to-emerald-300 opacity-60"
          style={{ width: p.size, height: p.size }}
          animate={{
            x: [0, p.x * 2, 0],
            y: [0, p.y * 2, 0],
            scale: [0, 1.5, 0],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut"
          }}
        />
      ))}

      {/* Rotating Circular Progress Rings */}
      <motion.div
        className="absolute inset-0 rounded-full border-[6px] border-transparent border-t-green-500 border-l-emerald-400 opacity-80"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      />
      
      <motion.div
        className="absolute inset-4 rounded-full border-[4px] border-transparent border-b-purple-500 border-r-blue-400 opacity-60"
        animate={{ rotate: -360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        className="absolute inset-8 rounded-full border-[4px] border-transparent border-t-white border-l-gray-300 opacity-40"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />

      {/* Center Pulse Core */}
      <motion.div
        className="absolute w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-700 rounded-full shadow-[0_0_30px_rgba(34,197,94,0.6)]"
        animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
};

export default DietAssignmentLoadingAnimation;