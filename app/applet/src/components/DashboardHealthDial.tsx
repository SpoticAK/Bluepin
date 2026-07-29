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

  const getThemeOpacityAndBrightness = (s: number) => {
    if (s >= 90) return { brightness: 1.05, opacity: 0.95 }; 
    if (s >= 75) return { brightness: 1.0, opacity: 0.9 }; 
    if (s >= 60) return { brightness: 0.95, opacity: 0.85 }; 
    if (s >= 40) return { brightness: 0.9, opacity: 0.8 }; 
    return { brightness: 0.85, opacity: 0.75 }; 
  };

  const details = score !== null ? getAssessment(score) : null;
  const themeParams = score !== null ? getThemeOpacityAndBrightness(score) : getThemeOpacityAndBrightness(0);
  
  // Base hue shift to make the green Element.png into a soft violet/lavender/pink gradient
  const HUE_ROTATE_DEG = 155;

  return (
    <div className="relative flex flex-col items-center justify-center py-4 w-full max-w-sm mx-auto overflow-hidden">
      <style>{`
        @keyframes gentle-float {
          0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
          50% { transform: translateY(-6px) scale(1.02) rotate(1deg); }
        }
        .animate-gentle-float {
          animation: gentle-float 8s ease-in-out infinite;
        }
      `}</style>
      <div className="relative w-[300px] h-[300px] flex items-center justify-center">
        
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
            className="w-[280px] h-[280px] object-cover transition-all duration-1000 animate-gentle-float"
            style={{ 
              filter: `hue-rotate(${HUE_ROTATE_DEG}deg) brightness(${themeParams.brightness}) saturate(0.85)`,
              opacity: themeParams.opacity
            }}
          />
        </div>
        
        {/* Inner Content */}
        <div className={cn(
          "relative z-10 flex flex-col items-center justify-center transition-all duration-1000 delay-300 w-full h-full",
          mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
        )}>
          {details && (
            <span 
              className="text-lg font-medium text-theme-text-sec mb-1" 
            >
              {details}
            </span>
          )}
          
          <div className="flex items-center justify-center relative -my-1">
            <span 
              className="text-[5.5rem] font-display font-medium leading-none tracking-tight text-theme-text"
            >
              {score !== null ? animatedScore : '--'}
            </span>
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-2 opacity-80">
            {scoreDiff !== 0 && score !== null ? (
              <>
                {scoreDiff > 0 ? (
                  <ArrowUp size={16} strokeWidth={2.5} className="text-theme-text-sec" />
                ) : (
                  <ArrowDown size={16} strokeWidth={2.5} className="text-theme-text-sec" />
                )}
                <span className="text-sm font-medium text-theme-text-sec">
                  {Math.abs(scoreDiff)} 
                </span>
              </>
            ) : (
              <span className="text-sm font-medium text-theme-text-sec">No change</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
