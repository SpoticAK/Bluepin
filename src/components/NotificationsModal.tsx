import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Bell,
  BellOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Smartphone,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { cn } from "../lib/utils";
import { auth } from "../lib/firebase";
import {
  detectPushAvailability,
  registerPushToken,
  unregisterPushToken,
  type PushAvailability,
} from "../lib/notifications";

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Shared reminder hour, shown so it is clear this channel follows the existing
   * schedule rather than defining a second one.
   */
  reminderHour?: number | null;
  reminderDisplay?: string | null;
}

interface PushSettingsResponse {
  pushEnabled: boolean;
  tokenCount: number;
  reminderHour: number | null;
  reminderLinked: boolean;
}

/** Why notifications cannot be turned on, in the user's terms. */
function unavailableMessage(availability: PushAvailability): string | null {
  switch (availability) {
    case "unsupported":
      return "This browser doesn't support notifications. Try Chrome, Edge, or Safari on desktop, or Chrome on Android.";
    case "insecure":
      return "Notifications need a secure connection. Open Bluepin over HTTPS and try again.";
    case "ios-needs-install":
      return "On iPhone and iPad, notifications only work once Bluepin is added to your Home Screen. Add it, then reopen the app.";
    case "ready":
      return null;
  }
}

export function NotificationsModal({
  isOpen,
  onClose,
  reminderHour,
  reminderDisplay,
}: NotificationsModalProps) {
  // Detected once on mount: these are platform facts that cannot change while
  // the page is open.
  const [availability] = useState<PushAvailability>(() =>
    detectPushAvailability(),
  );
  const [pushEnabled, setPushEnabled] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const res = await fetch("/api/notifications/push", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data: PushSettingsResponse = await res.json();
      setPushEnabled(data.pushEnabled);
      setTokenCount(data.tokenCount);
    } catch {
      // Non-fatal: the toggle below still works and surfaces its own errors.
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setNotice(null);
      fetchSettings();
    }
  }, [isOpen, fetchSettings]);

  // Escape closes this modal without closing the profile modal behind it.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // The browser may have revoked permission behind our back (settings change,
  // site data cleared). Reflect reality rather than a stale server flag.
  useEffect(() => {
    if (isOpen && typeof Notification !== "undefined") {
      setPushEnabled((current) =>
        Notification.permission === "denied" ? false : current,
      );
    }
  }, [isOpen]);

  const handleToggle = async () => {
    const nextEnabled = !pushEnabled;
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      if (nextEnabled) {
        const result = await registerPushToken();
        if (result.permission !== "granted") {
          setError(
            "Your browser blocked notifications. Allow them in your browser's site settings, then try again.",
          );
          return;
        }
        if (!result.registered) {
          setError(
            result.error ||
              "Could not turn on notifications. Please try again.",
          );
          return;
        }
        setNotice(
          "On — you'll get a browser nudge at the same time as your reminder.",
        );
      } else {
        const result = await unregisterPushToken();
        if (!result.ok) {
          setError(result.error || "Could not turn off notifications.");
          return;
        }
        setNotice("Off — you won't get browser notifications.");
      }

      setPushEnabled(nextEnabled);
      await fetchSettings();
    } finally {
      setLoading(false);
    }
  };

  const unavailable = unavailableMessage(availability);
  const canToggle = availability === "ready";

  const permissionDenied =
    typeof Notification !== "undefined" && Notification.permission === "denied";

  // Required: this modal's overlay is a fixed inset-0 layer. Without this guard
  // it renders permanently, sits above the profile modal, and blocks every click.
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-120 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* stopPropagation keeps this modal's dismissals from reaching the profile
          modal's own overlay handler underneath, which would close both. */}
      <div
        className="relative w-full sm:max-w-md bg-theme-card rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-theme-accent/10 border border-theme-accent/25 text-theme-accent flex items-center justify-center">
              <Bell size={17} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-theme-text leading-tight">
                Notifications
              </h3>
              <p className="text-[11px] text-theme-text-sec">
                Push notification on this device
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-theme-text-sec hover:bg-theme-card-sec hover:text-theme-text transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pb-5 flex flex-col gap-3">
          {/* Reminder link */}
          <div className="bg-theme-card-sec border border-theme-border/60 rounded-2xl p-4 flex items-start gap-3">
            <Clock size={14} className="text-theme-text-sec mt-0.5 shrink-0" />
            <p className="text-[11px] text-theme-text-sec leading-snug">
              Browser notifications follow your existing glucose reminder, so
              there's nothing extra to schedule.
              {reminderDisplay ? (
                <>
                  {" "}
                  You're set for{" "}
                  <span className="font-semibold text-theme-text">
                    {reminderDisplay}
                  </span>
                  .
                </>
              ) : (
                <>
                  {" "}
                  Set a time in{" "}
                  <span className="font-semibold text-theme-text">
                    WhatsApp Sync
                  </span>{" "}
                  to start receiving them.
                </>
              )}
            </p>
          </div>

          {/* Toggle */}
          <div className="bg-theme-card border border-theme-border/60 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={cn(
                  "w-9 h-9 rounded-full border flex items-center justify-center shrink-0",
                  pushEnabled
                    ? "bg-theme-accent/10 border-theme-accent/25 text-theme-accent"
                    : "bg-theme-card-sec border-theme-border text-theme-text-sec",
                )}
              >
                {pushEnabled ? <Bell size={17} /> : <BellOff size={17} />}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-theme-text leading-tight">
                  Daily glucose reminder
                </p>
                <p className="text-[11px] text-theme-text-sec mt-0.5">
                  {!canToggle
                    ? "Unavailable"
                    : pushEnabled
                      ? `On${tokenCount > 1 ? ` · ${tokenCount} devices` : ""}`
                      : "Off"}
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={pushEnabled}
              aria-label="Daily glucose notification"
              disabled={loading || !canToggle}
              onClick={handleToggle}
              className={cn(
                "relative w-12 h-7 rounded-full transition-colors shrink-0",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                pushEnabled ? "bg-theme-accent" : "bg-theme-border",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all",
                  pushEnabled ? "left-6" : "left-1",
                )}
              />
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-1 text-[11px] text-theme-text-sec">
              <Loader2 size={13} className="animate-spin" />
              <span>{pushEnabled ? "Turning off…" : "Turning on…"}</span>
            </div>
          )}

          {/* Messages */}
          {unavailable && (
            <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl p-3">
              <AlertCircle
                size={14}
                className="text-amber-500 mt-0.5 shrink-0"
              />
              <p className="text-[11px] text-theme-text-sec leading-snug">
                {unavailable}
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl p-3">
              <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-theme-text leading-snug">
                {error}
              </p>
            </div>
          )}

          {notice && !error && (
            <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3">
              <CheckCircle2
                size={14}
                className="text-emerald-500 mt-0.5 shrink-0"
              />
              <p className="text-[11px] text-theme-text-sec leading-snug">
                {notice}
              </p>
            </div>
          )}

          {permissionDenied && canToggle && (
            <div className="flex items-start gap-2.5 bg-theme-card-sec border border-theme-border rounded-xl p-3">
              <AlertCircle
                size={14}
                className="text-theme-text-sec mt-0.5 shrink-0"
              />
              <p className="text-[11px] text-theme-text-sec leading-snug">
                Notifications are currently blocked for this site. Re-enable
                them in your browser's site settings, then switch this on.
              </p>
            </div>
          )}

          {/* Privacy note */}
          <div className="flex items-start gap-2.5 bg-theme-card-sec border border-theme-border/60 rounded-xl p-3">
            <ShieldCheck
              size={14}
              className="text-theme-text-sec mt-0.5 shrink-0"
            />
            <p className="text-[11px] text-theme-text-sec leading-snug">
              Only nudge messages are sent to this device — never your glucose
              readings or health data. Turning this off removes this device
              immediately.
            </p>
          </div>

          {/* Device hint */}
          <div className="flex items-center gap-2 text-[10px] text-theme-text-sec/80 px-1">
            <Smartphone size={12} className="shrink-0" />
            <span>Works on this device and this browser only.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
