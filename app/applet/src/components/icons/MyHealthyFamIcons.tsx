import React from 'react';

export function InsightIcon({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5 L6 16 L17 18" />
      <circle cx="12" cy="5" r="2" fill="currentColor" stroke="currentColor" />
      <circle cx="6" cy="16" r="2" fill="currentColor" stroke="currentColor" />
      <circle cx="17" cy="18" r="2" fill="currentColor" stroke="currentColor" />
    </svg>
  );
}

export function ReminderIcon({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <defs>
        <mask id="hollow-node-mask">
          <rect width="24" height="24" fill="white" />
          <circle cx="20" cy="8" r="4" fill="black" stroke="none" />
        </mask>
      </defs>
      <path d="M17 18 L6 16 L12 5 L20 8" mask="url(#hollow-node-mask)" />
      
      {/* Filled nodes */}
      <circle cx="12" cy="5" r="2" fill="currentColor" stroke="currentColor" />
      <circle cx="6" cy="16" r="2" fill="currentColor" stroke="currentColor" />
      <circle cx="17" cy="18" r="2" fill="currentColor" stroke="currentColor" />
      
      {/* Hollow node */}
      <circle cx="20" cy="8" r="2" fill="none" stroke="currentColor" />
    </svg>
  );
}
