import React from 'react';

export const CustomFlameEmoji = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* Outer Flame Body */}
    <path 
      d="M50 5 C30 25 10 45 10 65 A40 40 0 0 0 90 65 C90 45 70 25 50 5 Z" 
      fill="#FF5F45" 
      stroke="#4B2117" 
      strokeWidth="5" 
      strokeLinejoin="round" 
    />
    {/* Inner Flame Highlight */}
    <path 
      d="M50 25 C38 40 22 55 22 70 A28 25 0 0 0 78 70 C78 55 62 40 50 25 Z" 
      fill="#FFAD38" 
    />
    
    {/* Blush */}
    <ellipse cx="28" cy="65" rx="6" ry="4" fill="#FF5F45" />
    <ellipse cx="72" cy="65" rx="6" ry="4" fill="#FF5F45" />
    
    {/* Eyes */}
    <circle cx="36" cy="60" r="4.5" fill="#4B2117" />
    <circle cx="34.5" cy="58.5" r="1.5" fill="#FFFFFF" />
    
    <circle cx="64" cy="60" r="4.5" fill="#4B2117" />
    <circle cx="62.5" cy="58.5" r="1.5" fill="#FFFFFF" />
    
    {/* Smile */}
    <path 
      d="M 45 65 Q 50 72 55 65" 
      fill="none" 
      stroke="#4B2117" 
      strokeWidth="3.5" 
      strokeLinecap="round" 
    />
  </svg>
);

export const CustomSmileEmoji = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="44" fill="#FFF100" stroke="#000000" strokeWidth="4" />
    <circle cx="35" cy="40" r="5" fill="#000000" />
    <circle cx="65" cy="40" r="5" fill="#000000" />
    <path 
      d="M 30 60 Q 50 78 70 60" 
      fill="none" 
      stroke="#000000" 
      strokeWidth="4" 
      strokeLinecap="round" 
    />
  </svg>
);

export const CustomCheckEmoji = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" 
      fill="#3A7D44" 
    />
  </svg>
);

export const CustomCrossEmoji = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" 
      fill="#C94C4C" 
    />
  </svg>
);
