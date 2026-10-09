import { useEffect, useState, useMemo } from "react";
import { useJoyride, STATUS } from "react-joyride";
import type { Step } from "react-joyride";
import { useAppStore } from "../store";
import { auth } from "../lib/firebase";
import { useTheme } from "../theme";

interface DashboardTourProps {
  activeTab?: string;
  setActiveTab?: (tab: any) => void;
}

export function DashboardTour({ setActiveTab }: DashboardTourProps) {
  const { profile, updateProfile } = useAppStore();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const uid = auth.currentUser?.uid;

  const [run, setRun] = useState(false);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("tour-state", { detail: run }));
  }, [run]);

  useEffect(() => {
    if (!uid) return;

    const storageKey = `bluepin_dashboard_tour_${uid}`;
    const urlParams = new URLSearchParams(window.location.search);
    const forceTour = urlParams.get("tour") === "true" || urlParams.has("tour");

    // Expose convenient reset method in console for development
    if (import.meta.env.DEV) {
      (window as any).resetDashboardTour = () => {
        try {
          localStorage.removeItem(storageKey);
        } catch {}
        updateProfile({ hasSeenDashboardTour: false });
        if (setActiveTab) setActiveTab("dashboard");
        setRun(false);
        setTimeout(() => setRun(true), 150);
        console.log("[Tour] Reset complete. Restarting tour...");
      };
    }

    const localCompleted = localStorage.getItem(storageKey) === "true";
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
        localStorage.setItem(`bluepin_dashboard_tour_${uid}`, "true");
      } catch {}
      updateProfile({ hasSeenDashboardTour: true });
    }
  };

  const steps: Step[] = useMemo(() => {
    const rawSteps: Step[] = [
      // 1. Quick Add (+) button in Dashboard
      {
        target: "#quick-add-button",
        title: "Add Health Data",
        content:
          "Tap the + button to add health data from here — upload reports, log glucose or weight.",
        placement: "top",
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 28,
        before: async (): Promise<void> => {
          if (setActiveTab) {
            setActiveTab("dashboard");
            await new Promise<void>((resolve) => setTimeout(resolve, 600));
          }
        },
      },
      // 2. WhatsApp icon in the header
      {
        target: () => {
          const isDesktop =
            typeof window !== "undefined" && window.innerWidth >= 768;
          const desktopBtn = document.getElementById("whatsapp-header-btn");
          const mobileBtn = document.getElementById("whatsapp-mobile-btn");
          if (isDesktop && desktopBtn) return desktopBtn;
          if (!isDesktop && mobileBtn) return mobileBtn;
          return (desktopBtn || mobileBtn || document.body) as HTMLElement;
        },
        title: "Sync WhatsApp",
        content:
          "Tap the WhatsApp icon to sync WhatsApp and get reminders and insights right in chat.",
        placement: "bottom-end",
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 20,
        before: async (): Promise<void> => {
          if (setActiveTab) {
            setActiveTab("dashboard");
            await new Promise<void>((resolve) => setTimeout(resolve, 400));
          }
        },
      },
    ];

    return rawSteps.map((s, i) => ({
      ...s,
      locale: {
        skip: `Step ${i + 1}/${rawSteps.length}`,
      },
    }));
  }, [setActiveTab]);

  const { Tour } = useJoyride({
    continuous: true,
    run,
    steps,
    scrollToFirstStep: true,
    options: {
      zIndex: 10000,
      primaryColor: "var(--color-theme-accent, #3b82f6)",
      backgroundColor: "var(--color-theme-card)",
      textColor: "var(--color-theme-text)",
      overlayColor: isDark ? "rgba(18, 19, 17, 0.8)" : "rgba(26, 26, 24, 0.6)",
      arrowColor: "var(--color-theme-card)",
      spotlightRadius: 28,
      spotlightPadding: 6,
      scrollOffset: 80,
      targetWaitTimeout: 3000,
      buttons: ["back", "close", "primary", "skip"],
      closeButtonAction: "skip",
      dismissKeyAction: "close",
    },
    locale: {
      back: "Previous",
      last: "Let's Go! 🚀",
      next: "Got it!",
    },
    styles: {
      tooltip: {
        borderRadius: 24,
        padding: "24px 24px",
        boxShadow:
          "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        border: "1px solid var(--color-theme-border)",
      },
      tooltipTitle: {
        fontSize: "18px",
        fontWeight: 700,
        marginBottom: "8px",
        color: "var(--color-theme-text)",
        fontFamily: "var(--font-display, inherit)",
      },
      tooltipContent: {
        fontSize: "14px",
        lineHeight: "1.6",
        color: "var(--color-theme-text-sec)",
        fontFamily: "var(--font-sans, inherit)",
      },
      buttonPrimary: {
        backgroundColor: "var(--color-theme-text)",
        color: "var(--color-theme-bg)",
        borderRadius: "20px",
        padding: "10px 24px",
        fontSize: "14px",
        fontWeight: 600,
        border: "none",
        outline: "none",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        fontFamily: "var(--font-sans, inherit)",
      },
      buttonBack: {
        color: "var(--color-theme-text-sec)",
        fontSize: "14px",
        fontWeight: 500,
        marginRight: "12px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-sans, inherit)",
      },
      buttonSkip: {
        color: "var(--color-theme-text-sec)",
        fontSize: "13px",
        fontWeight: 700,
        background: "transparent",
        border: "none",
        cursor: "default",
        pointerEvents: "none", // Makes it act like static text instead of a clickable skip button
        fontFamily: "var(--font-sans, inherit)",
        letterSpacing: "0.05em",
      },
      buttonClose: {
        color: "var(--color-theme-text-sec)",
        // ==========================================
        // CLOSE BUTTON (X) POSITION
        // Change the top and right values below to move the X
        // ==========================================
        top: "20px",
        right: "20px",
      },
    },
    onEvent: (data) => {
      if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
        markTourDone();
      }
    },
  });

  return <>{Tour}</>;
}

export default DashboardTour;
