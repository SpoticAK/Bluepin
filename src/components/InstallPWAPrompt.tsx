import React, { useState, useEffect } from "react";
import {
  Download,
  Share,
  X,
  Smartphone,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export const InstallPWAPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode (installed PWA)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone ||
      document.referrer.includes("android-app://");

    if (isStandalone) {
      return;
    }

    // Check if user dismissed prompt recently (e.g. within last 7 days)
    const dismissedTime = localStorage.getItem("bluepin_pwa_dismissed");
    if (dismissedTime) {
      const daysSinceDismissed =
        (Date.now() - parseInt(dismissedTime, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Detect iOS (iPadOS 13+ reports 'macintosh' in UA, so check maxTouchPoints too)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (/macintosh/.test(userAgent) && navigator.maxTouchPoints > 1);
    setIsIOS(iosDevice);

    if (iosDevice) {
      // Delay prompt for iOS users slightly so it doesn't immediately block onboarding
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Check if early event was already captured by index.html
    const existingPrompt = (window as any).__pwaInstallPrompt;
    if (existingPrompt) {
      setDeferredPrompt(existingPrompt);
      setShowPrompt(true);
    }

    // Capture standard install prompt on Chrome / Edge / Android / Desktop
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      (window as any).__pwaInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
      setShowPrompt(true);
    };

    const handlePromptReady = () => {
      if ((window as any).__pwaInstallPrompt) {
        setDeferredPrompt((window as any).__pwaInstallPrompt);
        setShowPrompt(true);
      }
    };

    const handleAppInstalled = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      (window as any).__pwaInstallPrompt = null;
      setInstalled(true);
      setTimeout(() => setInstalled(false), 5000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("pwa-prompt-ready", handlePromptReady);
    window.addEventListener("appinstalled", handleAppInstalled);

    // On Android / mobile browsers, if beforeinstallprompt is delayed by Chrome heuristics,
    // show prompt banner after 3 seconds so mobile users still see the install option
    const isMobileAndroid = /android/.test(userAgent);
    let fallbackTimer: NodeJS.Timeout | null = null;
    if (isMobileAndroid && !existingPrompt) {
      fallbackTimer = setTimeout(() => {
        setShowPrompt(true);
      }, 3500);
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("pwa-prompt-ready", handlePromptReady);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  const [showAndroidFallback, setShowAndroidFallback] = useState(false);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    const promptToUse = deferredPrompt || (window as any).__pwaInstallPrompt;

    if (!promptToUse) {
      // If browser hasn't fired beforeinstallprompt yet, show guide for Android Chrome
      setShowAndroidFallback(true);
      return;
    }

    try {
      await promptToUse.prompt();
      const choiceResult = await promptToUse.userChoice;

      if (choiceResult.outcome === "accepted") {
        console.log("[PWA] User accepted install prompt");
        setShowPrompt(false);
      } else {
        console.log("[PWA] User dismissed install prompt");
        handleDismiss();
      }
    } catch (err) {
      console.warn("[PWA] Install prompt error:", err);
      setShowAndroidFallback(true);
    }
    setDeferredPrompt(null);
    (window as any).__pwaInstallPrompt = null;
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSModal(false);
    setShowAndroidFallback(false);
    localStorage.setItem("bluepin_pwa_dismissed", Date.now().toString());
  };

  return (
    <>
      {/* Installed Toast Notification */}
      <AnimatePresence>
        {installed && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-2xl shadow-xl backdrop-blur-md"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-sm font-medium">
              Bluepin installed successfully!
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Install Prompt Banner */}
      <AnimatePresence>
        {showPrompt && !installed && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 bg-slate-900/95 border border-slate-700/60 shadow-2xl rounded-2xl p-4 backdrop-blur-xl text-slate-100"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-600 to-indigo-600 p-0.5 shadow-md flex items-center justify-center shrink-0">
                  <img
                    src="/pwa-192x192.png"
                    alt="Bluepin"
                    className="w-11 h-11 rounded-[10px] object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-semibold text-sm text-slate-100">
                      Install Bluepin App
                    </h4>
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Fast access, offline medical records, and full-screen
                    companion experience.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 flex items-center justify-center gap-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                Install Now
              </button>
              <button
                onClick={handleDismiss}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 py-2.5 px-3 rounded-xl hover:bg-slate-800 transition-colors"
              >
                Not Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Instructions Modal */}
      <AnimatePresence>
        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full text-slate-100 shadow-2xl relative"
            >
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-full hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">
                    Install on iOS
                  </h3>
                  <p className="text-xs text-slate-400">
                    Safari on iPhone & iPad
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                    1
                  </span>
                  <span>
                    Tap the <strong>Share</strong> button{" "}
                    <Share className="w-3.5 h-3.5 inline text-blue-400 mx-0.5" />{" "}
                    in your Safari toolbar at the bottom.
                  </span>
                </div>

                <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                    2
                  </span>
                  <span>
                    Scroll down the options list and tap{" "}
                    <strong>Add to Home Screen</strong>.
                  </span>
                </div>

                <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                    3
                  </span>
                  <span>
                    Tap <strong>Add</strong> in the top right corner to install
                    Bluepin on your device.
                  </span>
                </div>
              </div>

              <button
                onClick={handleDismiss}
                className="w-full mt-5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 rounded-xl transition-colors"
              >
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Android Manual Instructions Modal (Fallback) */}
      <AnimatePresence>
        {showAndroidFallback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full text-slate-100 shadow-2xl relative"
            >
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-full hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">
                    Install on Android
                  </h3>
                  <p className="text-xs text-slate-400">
                    Chrome / Edge Browser
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                    1
                  </span>
                  <span>
                    Tap the <strong>three dots menu (⋮)</strong> in the top-right corner of Chrome.
                  </span>
                </div>

                <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                    2
                  </span>
                  <span>
                    Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </span>
                </div>

                <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                    3
                  </span>
                  <span>
                    Tap <strong>Install</strong> to add Bluepin to your app drawer.
                  </span>
                </div>
              </div>

              <button
                onClick={handleDismiss}
                className="w-full mt-5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 rounded-xl transition-colors"
              >
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
