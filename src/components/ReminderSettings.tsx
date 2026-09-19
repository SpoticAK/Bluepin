import React, { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, X, Check, Plus, Trash2, Send, ShieldAlert, Clock } from "lucide-react";
import { cn } from "../lib/utils";
import { useAppStore } from "../store";
import {
  ensurePushSubscription,
  disablePushSubscription,
  sendTestNotification,
  requestNotificationPermission,
  getNotificationPermission,
  isPushSupported,
  type PushPermission,
} from "../lib/push";
import { DAY_LABELS, getNextRunTimestamp, formatReminderTime } from "../lib/reminderSchedule";

const MAX_TIMES = 4;

export default function ReminderSettings({ onClose }: { onClose: () => void }) {
  const { glucoseReminder, updateGlucoseReminder } = useAppStore();

  const [enabled, setEnabled] = useState(glucoseReminder?.enabled ?? false);
  const [everyDay, setEveryDay] = useState(
    (glucoseReminder?.days ?? []).length === 0,
  );
  const [selectedDays, setSelectedDays] = useState<number[]>(
    (glucoseReminder?.days ?? []).filter((d) => d >= 1 && d <= 7),
  );
  const [times, setTimes] = useState<string[]>(
    (glucoseReminder?.times ?? []).filter((t) => t),
  );
  const [message, setMessage] = useState(glucoseReminder?.message ?? "");

  const [permission, setPermission] = useState<PushPermission>(
    getNotificationPermission(),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const sortedTimes = useMemo(() => {
    return [...times].sort((a, b) => a.localeCompare(b));
  }, [times]);

  const nextRun = useMemo(() => {
    if (!enabled || !sortedTimes.length) return null;
    const days = everyDay ? [] : selectedDays;
    const tz =
      glucoseReminder?.tz ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC";
    return getNextRunTimestamp(sortedTimes, days, tz, Date.now() + 60_000);
  }, [enabled, sortedTimes, everyDay, selectedDays, glucoseReminder?.tz]);

  const addTime = () => {
    if (times.length >= MAX_TIMES) return;
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    const val = `${String(nextHour.getHours()).padStart(2, "0")}:${String(
      nextHour.getMinutes(),
    ).padStart(2, "0")}`;
    setTimes((t) => [...t, val].sort());
  };

  const removeTime = (t: string) => setTimes((arr) => arr.filter((x) => x !== t));

  const toggleDay = (day: number) => {
    setEveryDay(false);
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const toggleNotifications = async () => {
    if (permission === "granted") {
      setBusy("disable");
      try {
        await disablePushSubscription();
        setPermission(getNotificationPermission());
        setNotice("Notifications disabled on this device.");
      } catch (e: any) {
        setError(e?.message || "Could not disable notifications.");
      } finally {
        setBusy(null);
      }
      return;
    }
    setBusy("notifications");
    try {
      let current = getNotificationPermission();
      if (current === "default") {
        current = await requestNotificationPermission();
        setPermission(current);
      }
      if (current !== "granted") {
        if (current === "denied") {
          setError(
            "Notifications are blocked in your browser. Enable them in site settings to receive reminders.",
          );
        }
        return;
      }
      const result = await ensurePushSubscription();
      setPermission(getNotificationPermission());
      if (result.subscribed) {
        setNotice("Notifications enabled. You're all set!");
      }
    } catch (e: any) {
      setError(e?.message || "Could not enable notifications.");
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async () => {
    setBusy("test");
    setError(null);
    try {
      let current = getNotificationPermission();
      if (current === "default") {
        current = await requestNotificationPermission();
        setPermission(current);
      }
      if (current !== "granted") {
        setError("Allow notifications first, then send a test.");
        return;
      }
      await ensurePushSubscription();
      await sendTestNotification();
      setNotice("Test notification sent! Check your device.");
    } catch (e: any) {
      setError(e?.message || "Test notification failed.");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setError(null);
    const finalTimes = [...times]
      .map((t) => t.trim())
      .filter((t) => /^\d{1,2}:\d{2}$/.test(t));
    if (enabled && finalTimes.length === 0) {
      setError("Add at least one reminder time.");
      return;
    }
    setBusy("save");
    try {
      // Ensure the device is subscribed before saving an enabled reminder.
      if (enabled && permission === "granted") {
        await ensurePushSubscription();
      }
      const days = everyDay ? [] : selectedDays;
      const tz =
        glucoseReminder?.tz ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        "UTC";
      const nextRunTs = enabled
        ? getNextRunTimestamp(finalTimes, days, tz, Date.now() + 60_000)
        : null;

      await updateGlucoseReminder({
        enabled,
        times: finalTimes,
        days,
        tz,
        message: message.trim() || undefined,
        nextRunAt: nextRunTs,
      });
      setNotice(enabled ? "Reminder saved." : "Reminder turned off.");
    } catch (e: any) {
      setError(e?.message || "Could not save reminder settings.");
    } finally {
      setBusy(null);
    }
  };

  const notifGranted = permission === "granted";

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-theme-card w-full sm:w-130 max-h-[92vh] overflow-y-auto rounded-t-4xl sm:rounded-4xl shadow-2xl animate-in zoom-in-95 duration-300 border border-theme-border">
        <div className="sticky top-0 bg-theme-card/95 backdrop-blur-md z-10 flex items-center justify-between p-5 sm:p-6 border-b border-theme-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-500 flex items-center justify-center border border-red-500/25">
              {enabled ? <BellRing size={20} /> : <Bell size={20} />}
            </div>
            <div>
              <h3 className="text-lg font-display font-medium text-theme-text leading-tight">
                Glucose Reminder
              </h3>
              <p className="text-xs text-theme-text-sec font-medium">
                Alarms &amp; push notifications
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-theme-bg flex items-center justify-center text-theme-text-sec hover:text-theme-text transition-colors border border-theme-border"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Master toggle */}
          <button
            onClick={() => {
              setEnabled((v) => !v);
              setNotice(null);
            }}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-colors",
              enabled
                ? "bg-red-500/10 border-red-500/30"
                : "bg-theme-bg border-theme-border",
            )}
          >
            <span className="text-sm font-bold text-theme-text">
              Daily glucose reminder
            </span>
            <span
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors",
                enabled ? "bg-red-500" : "bg-theme-border",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                  enabled ? "left-5.5" : "left-0.5",
                )}
              />
            </span>
          </button>

          {/* Times */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-theme-text-sec">
                Reminder times
              </p>
              {times.length < MAX_TIMES && (
                <button
                  onClick={addTime}
                  className="flex items-center gap-1 text-xs font-bold text-theme-accent hover:underline"
                >
                  <Plus size={14} /> Add time
                </button>
              )}
            </div>
            {times.length === 0 ? (
              <p className="text-sm text-theme-text-sec/80 bg-theme-bg border border-dashed border-theme-border rounded-2xl px-4 py-4 text-center">
                No times set yet.
              </p>
            ) : (
              <div className="space-y-2">
                {[...times]
                  .sort((a, b) => a.localeCompare(b))
                  .map((t) => (
                    <div
                      key={t}
                      className="flex items-center gap-2 bg-theme-bg rounded-2xl border border-theme-border px-3 py-2.5"
                    >
                      <Clock size={16} className="text-theme-text-sec shrink-0" />
                      <input
                        type="time"
                        value={t}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          setTimes((arr) =>
                            arr.map((x) => (x === t ? e.target.value : x)),
                          );
                        }}
                        className="flex-1 bg-transparent text-theme-text text-sm font-bold focus:outline-none"
                        aria-label={`Reminder time ${t}`}
                      />
                      <button
                        onClick={() => removeTime(t)}
                        className="p-1.5 text-theme-text-sec hover:text-red-500 transition-colors"
                        aria-label="Remove time"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Days */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-theme-text-sec">
              Repeat on
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setEveryDay(true)}
                className={cn(
                  "px-3 py-2 rounded-xl text-xs font-bold border transition-colors",
                  everyDay
                    ? "bg-theme-accent text-white border-theme-accent"
                    : "bg-theme-bg text-theme-text-sec border-theme-border hover:text-theme-text",
                )}
              >
                Every day
              </button>
              {DAY_LABELS.map((label, i) => {
                const day = i + 1;
                const active = !everyDay && selectedDays.includes(day);
                return (
                  <button
                    key={label}
                    onClick={() => toggleDay(day)}
                    disabled={everyDay}
                    className={cn(
                      "w-10 h-10 rounded-xl text-xs font-bold border transition-colors",
                      active
                        ? "bg-theme-accent text-white border-theme-accent"
                        : "bg-theme-bg text-theme-text-sec border-theme-border",
                      everyDay && "opacity-40 cursor-not-allowed",
                    )}
                  >
                    {label[0]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-theme-text-sec">
              Leave on "Every day" for daily reminders.
            </p>
          </div>

          {/* Custom message */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-theme-text-sec">
              Reminder message <span className="opacity-60">(optional)</span>
            </p>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Time to check your blood sugar"
              className="w-full bg-theme-bg border border-theme-border rounded-2xl px-4 py-3 text-sm text-theme-text placeholder:text-theme-text-sec/50 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            />
          </div>

          {/* Notifications */}
          <div
            className={cn(
              "rounded-2xl border p-4 space-y-3",
              notifGranted
                ? "bg-emerald-500/5 border-emerald-500/25"
                : "bg-theme-bg border-theme-border",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
                  notifGranted
                    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/25"
                    : "bg-theme-card text-theme-text-sec border-theme-border",
                )}
              >
                {notifGranted ? <Check size={16} /> : <ShieldAlert size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-theme-text">
                  {notifGranted
                    ? "Notifications enabled"
                    : permission === "unsupported"
                      ? "Notifications not supported"
                      : permission === "denied"
                        ? "Notifications are blocked"
                        : "Enable notifications"}
                </p>
                <p className="text-xs text-theme-text-sec leading-relaxed mt-0.5">
                  {permission === "unsupported"
                    ? "This browser doesn't support web push. Reminders will still be saved for when you open Bluepin."
                    : permission === "denied"
                      ? "Allow notifications for Bluepin in your browser's site settings to receive reminder alarms."
                      : notifGranted
                        ? isPushSupported()
                          ? "You'll get an alarm-style notification at each reminder time."
                          : "Notifications enabled."
                        : "Allow notifications to receive an alarm at each reminder time."}
                </p>
              </div>
            </div>

            {permission !== "unsupported" && (
              <div className="flex flex-wrap gap-2">
                {!notifGranted && (
                  <button
                    onClick={toggleNotifications}
                    disabled={busy === "notifications"}
                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {busy === "notifications" ? "Enabling..." : (permission === "denied" ? "Open settings" : "Enable notifications")}
                  </button>
                )}
                {notifGranted && (
                  <>
                    <button
                      onClick={handleTest}
                      disabled={busy === "test"}
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                    >
                      <Send size={13} />
                      {busy === "test" ? "Sending..." : "Send test"}
                    </button>
                    <button
                      onClick={toggleNotifications}
                      disabled={busy === "disable"}
                      className="flex items-center gap-1.5 text-xs font-bold text-theme-text-sec border border-theme-border px-4 py-2.5 rounded-xl transition-colors hover:text-theme-text disabled:opacity-50"
                    >
                      {busy === "disable" ? "Disabling..." : "Turn off"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {nextRun && enabled && (
            <div className="flex items-center gap-2 bg-theme-accent/10 border border-theme-accent/20 rounded-2xl px-4 py-3 text-sm font-medium text-theme-accent">
              <BellRing size={16} className="shrink-0" />
              Next reminder: {formatReminderTime(nextRun)}
            </div>
          )}

          {notice && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-4 py-3 text-sm font-medium text-emerald-500">
              <Check size={16} className="shrink-0" />
              {notice}
            </div>
          )}
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3 text-sm font-medium text-red-500">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-theme-border text-theme-text-sec text-sm font-bold hover:text-theme-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy === "save"}
              className="flex-1 py-3 rounded-2xl bg-theme-text text-theme-bg dark:bg-white dark:text-[#0f172a] text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy === "save" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}