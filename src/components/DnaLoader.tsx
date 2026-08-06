import React from 'react';
import { motion } from 'motion/react';

export function DnaLoader({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-1.5 ${className}`}>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="relative w-2 h-10 flex items-center justify-center">
          <motion.div
            animate={{ y: [-12, 12, -12], scale: [1, 0.6, 1], zIndex: [10, 0, 10] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
            className="absolute w-2.5 h-2.5 rounded-full bg-[#792DF5] shadow-[0_0_8px_rgba(121,45,245,0.6)]"
          />
          <div className="w-px h-full bg-theme-border/50 absolute" />
          <motion.div
            animate={{ y: [12, -12, 12], scale: [0.6, 1, 0.6], zIndex: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
            className="absolute w-2.5 h-2.5 rounded-full bg-[#DF6D22] shadow-[0_0_8px_rgba(223,109,34,0.6)]"
          />
        </div>
      ))}
    </div>
  );
}
