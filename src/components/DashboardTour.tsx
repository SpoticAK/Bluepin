import React, { useEffect, useState, useMemo } from 'react';
import { useJoyride, STATUS, Status, Step, ACTIONS } from 'react-joyride';
import { useAppStore } from '../store';
import { auth } from '../lib/firebase';
import { useTheme } from '../theme';

interface DashboardTourProps {
  activeTab?: string;
  setActiveTab?: (tab: any) => void;
}

export function DashboardTour({ activeTab, setActiveTab }: DashboardTourProps) {
  const { profile, updateProfile } = useAppStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const uid = auth.currentUser?.uid;

  const [run, setRun] = useState(false);

  useEffect(() => {
    if (!uid) return;

    const storageKey = `bluepin_dashboard_tour_${uid}`;
    const urlParams = new URLSearchParams(window.location.search);
    const forceTour = urlParams.get('tour') === 'true' || urlParams.has('tour');

    // Expose convenient reset method in console for development
    if (import.meta.env.DEV) {
      (window as any).resetDashboardTour = () => {
        try {
          localStorage.removeItem(storageKey);
        } catch {}
        updateProfile({ hasSeenDashboardTour: false });
        if (setActiveTab) setActiveTab('dashboard');
        setRun(false);
        setTimeout(() => setRun(true), 150);
        console.log('[Tour] Reset complete. Restarting tour...');
      };
    }

    const localCompleted = localStorage.getItem(storageKey) === 'true';
    const profileCompleted = profile?.hasSeenDashboardTour === true;

    if (forceTour || (!localCompleted && !profileCompleted)) {
      // Delay slightly so the dashboard elements and animations settle
      const timer = setTimeout(() => {
        setRun(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [uid, profile?.hasSeenDashboardTour, setActiveTab]);

  const markTourDone = () => {
    setRun(false);
    if (uid) {
      try {
        localStorage.setItem(`bluepin_dashboard_tour_${uid}`, 'true');
      } catch {}
      updateProfile({ hasSeenDashboardTour: true });
    }
  };

  const steps: Step[] = useMemo(
    () => [
      // 1. Health Score (Dashboard)
      {
        target: '#health-score-section',
        title: 'Your Health Score',
        content:
          'This is your overall Health Score snapshot. It synthesizes your lab biomarkers into a single score — helping you quickly see which biomarkers are Optimal, Borderline, or need Attention.',
        placement: 'bottom',
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 28,
        before: async ({ action }) => {
          if (action === ACTIONS.PREV && setActiveTab) {
            setActiveTab('dashboard');
            return new Promise((resolve) => setTimeout(resolve, 200));
          }
        },
      },
      // 2. Quick Add Floating Button (Dashboard)
      {
        target: '#quick-add-button',
        title: 'Quick Add',
        content:
          'Use this button to quickly add new lab reports, log daily glucose readings, or update your weight anytime.',
        placement: 'top',
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 28,
        before: async ({ action }) => {
          if (action === ACTIONS.PREV && setActiveTab) {
            setActiveTab('dashboard');
            return new Promise((resolve) => setTimeout(resolve, 200));
          }
        },
      },
      // 3. Glucose Tab in Navigation
      {
        target: () =>
          ((window.innerWidth >= 768
            ? document.getElementById('nav-glucose-desktop')
            : document.getElementById('nav-glucose-mobile')) ||
          document.querySelector('[data-tour="nav-glucose"]')) as HTMLElement,
        title: 'Glucose Tracking',
        content:
          'Click on the Glucose tab (or click Next) to explore your daily blood sugar logs, trends, and metrics.',
        placement: window.innerWidth >= 768 ? 'right' : 'top',
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 16,
        before: async ({ action }) => {
          if (action === ACTIONS.PREV && setActiveTab) {
            setActiveTab('dashboard');
            return new Promise((resolve) => setTimeout(resolve, 200));
          }
        },
      },
      // 4. Today's Reading Card (Glucose Tab)
      {
        target: '#todays-glucose-card',
        title: "Today's Readings",
        content:
          'This card highlights your blood glucose readings for today across Fasting, Post-Prandial, and Random checks, comparing them directly against target healthy ranges.',
        placement: 'bottom',
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 32,
        before: async () => {
          if (setActiveTab) {
            setActiveTab('glucose');
            return new Promise((resolve) => setTimeout(resolve, 350));
          }
        },
      },
      // 5. Health Canvas Tab in Navigation
      {
        target: () =>
          ((window.innerWidth >= 768
            ? document.getElementById('nav-canvas-desktop')
            : document.getElementById('nav-canvas-mobile')) ||
          document.querySelector('[data-tour="nav-canvas"]')) as HTMLElement,
        title: 'Health Canvas Tab',
        content:
          'Click on the Health Canvas tab (or click Next) to view your comprehensive biomarker breakdown and report history.',
        placement: window.innerWidth >= 768 ? 'right' : 'top',
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 16,
        before: async ({ action }) => {
          if (action === ACTIONS.PREV && setActiveTab) {
            setActiveTab('glucose');
            return new Promise((resolve) => setTimeout(resolve, 250));
          }
        },
      },
      // 6. Health Canvas Area (Canvas Tab)
      {
        target: '#health-canvas-area',
        title: 'Your Health Canvas',
        content:
          'This is your Health Canvas. It categorizes all your biomarkers (Lipid, Liver, Kidney, Thyroid, and more) against clinical optimal ranges and tracks your health score across lab reports over time.',
        placement: 'bottom',
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 28,
        before: async () => {
          if (setActiveTab) {
            setActiveTab('biomarkers');
          }
          const dashBtn = document.getElementById('canvas-dashboard-tab');
          if (dashBtn) dashBtn.click();
          return new Promise((resolve) => setTimeout(resolve, 350));
        },
      },
      // 7. Reports Timeline Area (Canvas Tab - Timeline View)
      {
        target: '#canvas-timeline-area',
        title: 'Reports Timeline',
        content:
          'Here you can see all your past medical reports in chronological order, view test dates, download original files, or remove reports if needed.',
        placement: 'top',
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 28,
        before: async () => {
          if (setActiveTab) {
            setActiveTab('biomarkers');
          }
          const timelineBtn = document.getElementById('canvas-timeline-tab');
          if (timelineBtn) timelineBtn.click();
          return new Promise((resolve) => setTimeout(resolve, 350));
        },
      },
      // 8. AI Highlights Button (Canvas Tab)
      {
        target: '#canvas-highlights-button',
        title: 'AI Highlights',
        content:
          'Click Highlights anytime to generate AI-powered clinical insights from your lab reports, summarizing what is progressing well and what needs attention.',
        placement: 'bottom-end',
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 20,
        before: async () => {
          if (setActiveTab) {
            setActiveTab('biomarkers');
          }
          return new Promise((resolve) => setTimeout(resolve, 200));
        },
      },
      // 9. Profile Button
      {
        target: () =>
          ((window.innerWidth >= 768
            ? document.getElementById('profile-btn-desktop')
            : document.getElementById('profile-btn-mobile')) ||
          document.querySelector('[data-tour="profile-btn"]')) as HTMLElement,
        title: 'Profile & Settings',
        content:
          'Access your profile to update health measurements (height, weight, diabetes status), customize app settings, view legal documents, or sign out.',
        placement: 'bottom-end',
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 20,
      },
      // 10. Talk to Founder Button
      {
        target: () =>
          ((window.innerWidth >= 768
            ? document.getElementById('talk-founder-desktop')
            : document.getElementById('talk-founder-mobile')) ||
          document.querySelector('[data-tour="talk-founder-btn"]')) as HTMLElement,
        title: 'Talk to the Founder',
        content:
          'Have questions, feedback, or need personal support? Click here anytime to reach out directly to the founder and help shape the future of Bluepin.',
        placement: 'bottom-end',
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 20,
      },
    ],
    [setActiveTab],
  );

  const { Tour, controls } = useJoyride({
    continuous: true,
    run,
    steps,
    scrollToFirstStep: true,
    options: {
      zIndex: 10000,
      primaryColor: '#2563eb',
      backgroundColor: isDark ? '#18181b' : '#ffffff',
      textColor: isDark ? '#f4f4f5' : '#18181b',
      overlayColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.6)',
      arrowColor: isDark ? '#18181b' : '#ffffff',
      spotlightRadius: 28,
      spotlightPadding: 6,
      scrollOffset: 80,
      targetWaitTimeout: 3000,
      buttons: ['back', 'close', 'primary', 'skip'],
      closeButtonAction: 'skip',
      dismissKeyAction: 'close',
    },
    locale: {
      back: 'Back',
      skip: 'Skip Tour',
      last: 'End Tour',
      next: 'Next',
    },
    styles: {
      tooltip: {
        borderRadius: 20,
        padding: '20px 22px',
        boxShadow: isDark
          ? '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
          : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
      },
      tooltipTitle: {
        fontSize: '17px',
        fontWeight: 600,
        marginBottom: '6px',
        color: isDark ? '#ffffff' : '#0f172a',
      },
      tooltipContent: {
        fontSize: '13.5px',
        lineHeight: '1.55',
        color: isDark ? '#a1a1aa' : '#475569',
      },
      buttonPrimary: {
        backgroundColor: '#2563eb',
        color: '#ffffff',
        borderRadius: '12px',
        padding: '8px 20px',
        fontSize: '13.5px',
        fontWeight: 600,
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
      },
      buttonBack: {
        color: isDark ? '#a1a1aa' : '#64748b',
        fontSize: '13.5px',
        fontWeight: 500,
        marginRight: '8px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
      },
      buttonSkip: {
        color: isDark ? '#71717a' : '#94a3b8',
        fontSize: '13px',
        fontWeight: 500,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
      },
      buttonClose: {
        color: isDark ? '#71717a' : '#94a3b8',
      },
    },
    onEvent: (data) => {
      if (([STATUS.FINISHED, STATUS.SKIPPED] as Status[]).includes(data.status)) {
        markTourDone();
      }
    },
  });

  // Auto-advance if user clicks the nav tab directly
  useEffect(() => {
    if (!run) return;
    try {
      const state = controls.info();
      if (!state) return;
      // Step 3 (index 2): Glucose tab nav -> advance to Step 4 if activeTab becomes 'glucose'
      if (activeTab === 'glucose' && state.index === 2) {
        controls.next();
      }
      // Step 5 (index 4): Canvas tab nav -> advance to Step 6 if activeTab becomes 'biomarkers'
      if (activeTab === 'biomarkers' && state.index === 4) {
        controls.next();
      }
    } catch {}
  }, [activeTab, run, controls]);

  const restartTour = () => {
    if (uid) {
      try {
        localStorage.removeItem(`bluepin_dashboard_tour_${uid}`);
      } catch {}
      updateProfile({ hasSeenDashboardTour: false });
    }
    const dashBtn = document.getElementById('canvas-dashboard-tab');
    if (dashBtn) dashBtn.click();
    if (setActiveTab) setActiveTab('dashboard');
    setRun(false);
    setTimeout(() => {
      setRun(true);
    }, 150);
  };

  return (
    <>
      {Tour}
      {/* Temporary button to restart the tour */}
      <div className="fixed bottom-24 md:bottom-8 left-6 md:left-72 z-50">
        <button
          type="button"
          onClick={restartTour}
          title="Temporary Dev Button: Restart Tour"
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-full shadow-lg border border-white/20 transition-all cursor-pointer"
        >
          <span>✨</span>
          <span>Restart Tour</span>
        </button>
      </div>
    </>
  );
}

export default DashboardTour;
