import React from 'react';
import { cn } from '../lib/utils';

interface ActivityCircleProps {
  status: 'completed' | 'partial' | 'missed' | 'none';
  isToday?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  isSelected?: boolean;
}

export function emojiToStatus(emoji: string): 'completed' | 'partial' | 'missed' | 'none' {
  if (emoji === '🔥') return 'completed';
  if (emoji === '🙌') return 'partial';
  if (emoji === '⚪') return 'none';
  return 'missed';
}

export const ActivityCircle: React.FC<ActivityCircleProps> = ({ status, isToday, size = 'sm', className, isSelected }: ActivityCircleProps) => {
  let sizeClasses = "w-3.5 h-3.5 sm:w-4 sm:h-4"; // sm
  if (size === 'xs') sizeClasses = "w-[10px] h-[10px]";
  if (size === 'md') sizeClasses = "w-[20px] h-[20px] sm:w-[28px] sm:h-[28px]"; // md
  if (size === 'lg') sizeClasses = "w-6 h-6 sm:w-8 sm:h-8"; // lg

  const isGreen = status === 'completed';
  const isAmber = status === 'partial';
  const isMissed = status === 'missed';
  const isNone = status === 'none';

  const hasShadow = size === 'md' || size === 'lg';

  let colorClasses = "";
  if (isGreen) {
    colorClasses = hasShadow 
      ? "bg-[#22c55e] dark:bg-[#22c55e] shadow-[0_0_12px_rgba(34,197,94,0.3)] text-transparent"
      : "bg-[#22c55e] dark:bg-[#22c55e]";
  } else if (isAmber) {
    colorClasses = hasShadow
      ? "bg-[#f59e0b] dark:bg-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.3)] text-transparent"
      : "bg-[#f59e0b] dark:bg-[#f59e0b]";
  } else if (isMissed) {
    colorClasses = "border-[1.5px] border-neutral-300 dark:border-neutral-700 bg-transparent";
  } else {
    colorClasses = hasShadow 
      ? "border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-transparent"
      : "bg-theme-bg border-[1.5px] border-theme-border shadow-sm";
  }

  let ringClasses = "";
  if (isToday) {
    if (size === 'md' || size === 'lg') {
      ringClasses = "ring-2 ring-theme-text scale-110";
    } else {
      ringClasses = "ring-[1px] ring-offset-[1px] ring-offset-theme-card";
      if (isGreen) ringClasses += " ring-green-400";
      else if (isAmber) ringClasses += " ring-amber-300";
      else ringClasses += " ring-theme-border";
    }
  } else if (isSelected) {
    ringClasses = "ring-2 ring-theme-text ring-offset-2 ring-offset-theme-bg scale-110";
  }

  return (
    <div 
      className={cn(
        "rounded-full flex items-center justify-center transition-all duration-300 shrink-0",
        sizeClasses,
        colorClasses,
        ringClasses,
        className
      )} 
    />
  );
}
