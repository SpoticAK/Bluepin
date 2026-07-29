import { getHealthScoreTheme } from '../lib/scoreColor';
import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface HealthDialProps {
  score: number | null;
  scoreDiff: number;
}

export const DashboardHealthDial: React.FC<HealthDialProps> = ({ score, scoreDiff }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const mountTimer = setTimeout(() => setMounted(true), 100);
    
    if (score !== null) {
      const duration = 1500;
      const steps = 60;
      const stepTime = duration / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current += 1;
        const progress = current / steps;
        const ease = 1 - Math.pow(1 - progress, 4); // Quartic ease out
        setAnimatedScore(Math.round(ease * score));
        
        if (current >= steps) {
          clearInterval(timer);
          setAnimatedScore(score);
        }
      }, stepTime);
      
      return () => {
        clearInterval(timer);
        clearTimeout(mountTimer);
      };
    } else {
      setAnimatedScore(0);
      return () => clearTimeout(mountTimer);
    }
  }, [score]);

  const getAssessment = (s: number) => {
    if (s >= 90) return 'Flourishing';
    if (s >= 75) return 'Good';
    if (s >= 60) return 'Fair';
    if (s >= 40) return 'Needs Care';
    return 'Action Needed';
  };

  const details = score !== null ? getAssessment(score) : null;
  const themeParams = getHealthScoreTheme(score);

  return (
    <div className="relative flex flex-col items-center justify-center -my-2 py-0 w-full max-w-sm mx-auto pointer-events-none">
      <style>{`
        @keyframes gentle-float {
          0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
          50% { transform: translateY(-4px) scale(1.01) rotate(0.5deg); }
        }
        .health-blob {
          filter: hue-rotate(var(--blob-hue)) brightness(var(--blob-brightness)) saturate(0.85);
          opacity: var(--blob-opacity);
        }
        .dark .health-blob {
          filter: invert(1) hue-rotate(var(--blob-hue-dark)) brightness(calc(var(--blob-brightness) * 1.3)) saturate(1.2);
          mix-blend-mode: screen;
        }
        .animate-gentle-float {
          animation: gentle-float 8s ease-in-out infinite;
        }
      `}</style>
      <div className="relative w-[300px] h-[220px] flex items-center justify-center pointer-events-auto">
        
        {/* Image Background */}
        <div 
          className={cn(
            "absolute inset-0 z-0 flex items-center justify-center transition-all duration-1000 ease-out",
            mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
          )}
        >
          <img 
            src="/Element.png" 
            alt="Health Status Background" 
            className="w-[280px] h-[280px] object-cover transition-all duration-1000 animate-gentle-float health-blob"
            style={{ 
              '--blob-hue': `${themeParams.hueRotate}deg`,
              '--blob-hue-dark': `${themeParams.hueRotateDark}deg`,
              '--blob-brightness': themeParams.brightness,
              '--blob-opacity': themeParams.opacity
            } as React.CSSProperties}
          />
        </div>
        
        {/* Inner Content */}
        <div className={cn(
          "relative z-10 flex flex-col items-center justify-center transition-all duration-1000 delay-300 w-full h-full",
          mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
        )}>
          {/* Milky Halo behind text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
             <div className="w-[150px] h-[150px] bg-white/60 dark:bg-[#171717]/60 blur-[28px] rounded-full" />
          </div>
          {details && (
            <span 
              className="text-base font-semibold text-[#171717] dark:text-white mb-1 z-10" 
            >
              {details}
            </span>
          )}
          
          <div className="flex items-center justify-center relative -my-1 z-10">
            <span 
              className="text-[4.5rem] font-display font-semibold leading-none tracking-tight text-[#171717] dark:text-white"
            >
              {score !== null ? animatedScore : '--'}
            </span>
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-2 z-10">
            {scoreDiff !== 0 && score !== null ? (
              <>
                {scoreDiff > 0 ? (
                  <ArrowUp size={16} strokeWidth={2.5} className="text-[#333333] dark:text-white/90 opacity-90" />
                ) : (
                  <ArrowDown size={16} strokeWidth={2.5} className="text-[#333333] dark:text-white/90 opacity-90" />
                )}
                <span className="text-sm font-medium text-[#333333] dark:text-white/90 opacity-90">
                  {Math.abs(scoreDiff)} 
                </span>
              </>
            ) : (
              <span className="text-sm font-medium text-[#333333] dark:text-white/90 opacity-90">No change</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
