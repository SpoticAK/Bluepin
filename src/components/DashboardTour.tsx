import { useEffect, useState, useMemo } from "react";
import { useJoyride, STATUS, ACTIONS } from "react-joyride";
import type { Step, TourData } from "react-joyride";
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
    const closeBtn = document.getElementById("close-glucose-modal-btn");
    if (closeBtn) closeBtn.click();
    if (uid) {
      try {
        localStorage.setItem(`bluepin_dashboard_tour_${uid}`, "true");
      } catch {}
      updateProfile({ hasSeenDashboardTour: true });
    }
  };

  const steps: Step[] = useMemo(
    () => [
      // 1. Health Score (Dashboard)
      {
        target: "#health-score-section",
        title: "Your Health Score",
        content: "View your health in one place after uploading reports",
        placement: "bottom",
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 28,
        before: async ({ action }: TourData): Promise<void> => {
          if (action === ACTIONS.PREV && setActiveTab) {
            setActiveTab("dashboard");
            await new Promise<void>((resolve) => setTimeout(resolve, 600));
          }
        },
      },
      // 2. Add Glucose Reading Button (Glucose Tab)
      {
        target: "#add-glucose-reading-button",
        title: "Add Glucose Reading",
        content: "Add daily glucose to track your blood sugar levels",
        placement: "bottom-end",
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 16,
        before: async (): Promise<void> => {
          const closeBtn = document.getElementById("close-glucose-modal-btn");
          if (closeBtn) closeBtn.click();
          if (setActiveTab) {
            setActiveTab("glucose");
            await new Promise<void>((resolve) => setTimeout(resolve, 600));
          }
        },
      },
      // 3. Add Glucose Reading Modal (Glucose Tab)
      {
        target: "#add-glucose-modal-content",
        title: "Add Glucose Reading",
        content:
          "click and upload a pic of your blood sugar reading or enter it manually",
        placement: "bottom",
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 32,
        before: async (): Promise<void> => {
          if (setActiveTab) {
            setActiveTab("glucose");
          }
          const modalContent = document.getElementById(
            "add-glucose-modal-content",
          );
          if (!modalContent) {
            const addBtn = document.getElementById(
              "add-glucose-reading-button",
            );
            if (addBtn) addBtn.click();
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 600));
        },
      },
      // 4. Sugar Health Button (Glucose Tab)
      {
        target: "#sugar-health-button",
        title: "Sugar Health",
        content:
          "BluePin AI analyses your sugar readings to give you insights. More readings will produce better insights.",
        placement: "bottom-end",
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 16,
        before: async (): Promise<void> => {
          const closeBtn = document.getElementById("close-glucose-modal-btn");
          if (closeBtn) closeBtn.click();
          if (setActiveTab) {
            setActiveTab("glucose");
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 600));
        },
      },
      // 5. Upload Health Report Floating Button (Canvas Tab)
      {
        target: "#canvas-upload-report-button",
        title: "Upload Reports",
        content:
          "Upload health lab reports in health canvas section. Uploading a few health reports from the past would be really useful.",
        placement: "top",
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 28,
        before: async (): Promise<void> => {
          if (setActiveTab) {
            setActiveTab("biomarkers");
          }
          const dashBtn = document.getElementById("canvas-dashboard-tab");
          if (dashBtn) dashBtn.click();
          await new Promise<void>((resolve) => setTimeout(resolve, 600));
        },
      },
      // 6. AI Highlights Button (Canvas Tab)
      {
        target: "#canvas-highlights-button",
        title: "Highlights",
        content:
          "Get Insights about how your health has changed overtime and what needs Attention. Uploading reports from past helps us understand you better :)",
        placement: "bottom-end",
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 20,
        before: async (): Promise<void> => {
          if (setActiveTab) {
            setActiveTab("biomarkers");
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 600));
        },
      },
    ],
    [setActiveTab],
  );

  const { Tour } = useJoyride({
    continuous: true,
    run,
    steps,
    scrollToFirstStep: true,
    options: {
      zIndex: 10000,
      primaryColor: "#3b82f6",
      backgroundColor: isDark ? "#1f2937" : "#ffffff",
      textColor: isDark ? "#f3f4f6" : "#1e293b",
      overlayColor: isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(15, 23, 42, 0.4)",
      arrowColor: isDark ? "#1f2937" : "#ffffff",
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
      skip: "Maybe later",
      last: "Let's Go! 🚀",
      next: "Got it!",
    },
    styles: {
      tooltip: {
        borderRadius: 24,
        padding: "24px 24px",
        boxShadow: isDark
          ? "0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)"
          : "0 20px 25px -5px rgba(59, 130, 246, 0.15), 0 8px 10px -6px rgba(59, 130, 246, 0.05)",
        border: isDark
          ? "1px solid rgba(255, 255, 255, 0.1)"
          : "1px solid rgba(59, 130, 246, 0.1)",
      },
      tooltipTitle: {
        fontSize: "18px",
        fontWeight: 700,
        marginBottom: "8px",
        color: isDark ? "#ffffff" : "#0f172a",
        fontFamily: "inherit",
      },
      tooltipContent: {
        fontSize: "14px",
        lineHeight: "1.6",
        color: isDark ? "#cbd5e1" : "#475569",
      },
      buttonPrimary: {
        backgroundColor: "#3b82f6",
        color: "#ffffff",
        borderRadius: "20px",
        padding: "10px 24px",
        fontSize: "14px",
        fontWeight: 600,
        border: "none",
        outline: "none",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
      },
      buttonBack: {
        color: isDark ? "#94a3b8" : "#64748b",
        fontSize: "14px",
        fontWeight: 500,
        marginRight: "12px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
      },
      buttonSkip: {
        color: isDark ? "#64748b" : "#94a3b8",
        fontSize: "13px",
        fontWeight: 500,
        background: "transparent",
        border: "none",
        cursor: "pointer",
      },
      buttonClose: {
        color: isDark ? "#64748b" : "#94a3b8",
      },
    },
    onEvent: (data) => {
      if (
        data.status === STATUS.FINISHED ||
        data.status === STATUS.SKIPPED
      ) {
        markTourDone();
      }
    },
  });


  const restartTour = () => {
    const closeBtn = document.getElementById("close-glucose-modal-btn");
    if (closeBtn) closeBtn.click();
    if (uid) {
      try {
        localStorage.removeItem(`bluepin_dashboard_tour_${uid}`);
      } catch {}
      updateProfile({ hasSeenDashboardTour: false });
    }
    const dashBtn = document.getElementById("canvas-dashboard-tab");
    if (dashBtn) dashBtn.click();
    if (setActiveTab) setActiveTab("dashboard");
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
