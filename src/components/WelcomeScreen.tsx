import React from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

export default function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen bg-theme-card text-theme-text flex flex-col justify-center items-center p-4 relative">
      <div className="w-full max-w-sm z-10 flex flex-col h-full md:h-auto md:justify-center">
        
        {/* Logo/Brand */}
        <div className="flex justify-center mb-3">
          <div className="flex items-center gap-2" style={{ animation: 'float 5s ease-in-out infinite' }}>
            <img
              src="/Bluepin.png"
              alt="Bluepin Logo"
              className="w-12 h-12 object-contain"
            />
            <h1 className="text-5xl font-display tracking-tight text-theme-text">
              <span className="font-bold">Blue</span>
              <span className="font-medium opacity-80">pin.</span>
            </h1>
          </div>
        </div>

        {/* Hero */}
        <div className="text-center mb-8">
          <p className="text-[20px] md:text-[21px] text-theme-text leading-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
            Managing <span className="bg-linear-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent font-medium">diabetes</span> just got simpler.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="mb-6 flex-1 flex flex-col justify-center">
          {/* Card 1 */}
          <div className="py-4 border-t border-b border-theme-border flex items-center gap-5">
            <div className="shrink-0 flex items-center justify-center w-12 h-12">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="curveGradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#a855f7" />
                    <stop offset="1" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <path d="M5 30 Q 15 30 20 20 T 35 10" stroke="url(#curveGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <circle cx="35" cy="10" r="3" fill="#6366f1" />
                <circle cx="5" cy="30" r="2" fill="#a855f7" />
                <circle cx="20" cy="20" r="2" fill="#8b5cf6" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-theme-text text-sm mb-0.5" style={{ fontFamily: 'Garet, sans-serif' }}>AI Pattern Analysis</h3>
              <p className="text-[13px] text-theme-text-sec leading-tight">
                Discover hidden trends in your glucose and biomarker levels.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="py-4 border-b border-theme-border flex items-center gap-5">
            <div className="shrink-0 flex items-center justify-center w-12 h-12 relative">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="6" width="20" height="28" rx="2" stroke="currentColor" className="text-theme-text-sec/60" strokeWidth="1.5" />
                <line x1="14" y1="14" x2="26" y2="14" stroke="currentColor" className="text-theme-text-sec/40" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="14" y1="20" x2="26" y2="20" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="14" y1="26" x2="22" y2="26" stroke="currentColor" className="text-theme-text-sec/40" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <svg className="absolute -left-1 top-2" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 19V5M5 12l7-7 7 7" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <svg className="absolute -right-1 bottom-2" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5v14M5 12l7 7 7-7" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-theme-text text-sm mb-0.5" style={{ fontFamily: 'Garet, sans-serif' }}>Personalized Insights</h3>
              <p className="text-[13px] text-theme-text-sec leading-tight">
                Understand what changed, why it matters, and what deserves your attention.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="py-4 border-b border-theme-border flex items-center gap-5">
            <div className="shrink-0 flex items-center justify-center w-12 h-12 relative">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 18 C 18 36 30 36 36 18" stroke="currentColor" className="text-theme-border" strokeWidth="1" strokeDasharray="2 2" fill="none" strokeLinecap="round" />
                <rect x="6" y="12" width="10" height="14" rx="1.5" className="fill-theme-card stroke-theme-text-sec/60" strokeWidth="1.2" />
                <line x1="8" y1="16" x2="14" y2="16" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="8" y1="20" x2="12" y2="20" stroke="currentColor" className="text-theme-border" strokeWidth="1" strokeLinecap="round" />
                
                <rect x="19" y="22" width="10" height="14" rx="1.5" className="fill-theme-card stroke-theme-text-sec/60" strokeWidth="1.2" />
                <line x1="21" y1="26" x2="27" y2="26" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="21" y1="30" x2="25" y2="30" stroke="currentColor" className="text-theme-border" strokeWidth="1" strokeLinecap="round" />
                
                <rect x="32" y="12" width="10" height="14" rx="1.5" className="fill-theme-card stroke-theme-text-sec/60" strokeWidth="1.2" />
                <line x1="34" y1="16" x2="40" y2="16" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="34" y1="20" x2="38" y2="20" stroke="currentColor" className="text-theme-border" strokeWidth="1" strokeLinecap="round" />
              </svg>
              <span className="absolute -top-1 -left-2 text-[8px] font-bold text-blue-500 opacity-80 rotate-[-10deg]">LDL</span>
              <span className="absolute top-10 -left-1 text-[8px] font-bold text-purple-500 opacity-80 rotate-[15deg]">CRP</span>
              <span className="absolute top-0 right-0 text-[8px] font-bold text-emerald-500 opacity-80 rotate-[10deg]">HbA1c</span>
              <span className="absolute top-10 -right-2 text-[8px] font-bold text-amber-500 opacity-80 rotate-[-15deg]">TSH</span>
            </div>
            <div>
              <h3 className="font-semibold text-theme-text text-sm mb-0.5" style={{ fontFamily: 'Garet, sans-serif' }}>Unified Health Data</h3>
              <p className="text-[13px] text-theme-text-sec leading-tight">
                Keep every lab report and glucose reading together in one organized timeline.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-auto md:mt-0 pt-2 pb-4 md:pb-0">
          <button
            onClick={onStart}
            className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-[15px] py-3.5 rounded-full shadow-[0_8px_20px_-6px_rgba(26,115,232,0.4)] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(26,115,232,0.6)] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Get Started :)
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
