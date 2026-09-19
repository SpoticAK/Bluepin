import { getAdminFirestore } from "../firebase";
import { sendPush, type PushPayload } from "./pushService";
import { getNextRunTimestamp } from "../../src/lib/reminderSchedule";

const TICK_MS = 30_000;
const BATCH_LIMIT = 50;
let running = false;
let timer: NodeJS.Timeout | null = null;

export function startReminderScheduler() {
  if (timer) return;
  timer = setInterval(runReminderTick, TICK_MS);
  // First pass shortly after boot.
  setTimeout(() => {
    runReminderTick().catch((e) => console.error("[reminder] scheduler error:", e));
  }, 3000);
}

function normalizeTs(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (typeof v === "object") {
    const o = v as { toMillis?: () => number; seconds?: number; milliseconds?: number };
    if (typeof o.toMillis === "function") return o.toMillis();
    if (typeof o.seconds === "number") return o.seconds * 1000 + (o.milliseconds || 0);
  }
  return null;
}

export async function runReminderTick(): Promise<void> {
  if (running) return;
  running = true;
  const db = getAdminFirestore();
  try {
    const now = new Date();
    const nowMs = now.getTime();
    const snap = await db
      .collection("glucoseReminders")
      .where("enabled", "==", true)
      .limit(BATCH_LIMIT)
      .get();

    const batch = db.batch();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data || data.enabled !== true) continue;

      const nextRunMs = normalizeTs(data.nextRunAt);
      if (nextRunMs == null || nextRunMs > nowMs) continue;

      const times: string[] = Array.isArray(data.times)
        ? data.times.filter((t) => typeof t === "string" && t)
        : [];
      if (!times.length) continue;

      const uid: string = data.userId || doc.id;
      const days: number[] = Array.isArray(data.days)
        ? data.days.map((d: any) => Number(d)).filter((n: number) => !Number.isNaN(n))
        : [];
      const tz: string = typeof data.tz === "string" && data.tz ? data.tz : "UTC";

      const nextRun = getNextRunTimestamp(times, days, tz, now.getTime() + 1000);
      if (nextRun == null) continue;

      // Send push to every active subscription for this user.
      const subsSnap = await db
        .collection("pushSubscriptions")
        .where("userId", "==", uid)
        .get();

      const payload: PushPayload = {
        title: "Time to log your glucose",
        body: typeof data.message === "string" && data.message
          ? data.message
          : `Reminder to check your blood glucose${
              times.length ? ` (scheduled near ${times[0]})` : ""
            }.`,
        url: "/?tab=glucose",
        tag: "glucose-reminder",
        requireInteraction: true,
        vibrate: [300, 120, 300, 120, 300],
      };

      const staleIds: string[] = [];
      for (const sub of subsSnap.docs) {
        const subData = sub.data();
        if (!subData?.endpoint || !subData?.keys?.p256dh || !subData?.keys?.auth) {
          staleIds.push(sub.id);
          continue;
        }
        const result = await sendPush(
          { endpoint: subData.endpoint, keys: { p256dh: subData.keys.p256dh, auth: subData.keys.auth } },
          payload,
        ).catch(() => null);
        if (result && !result.ok) staleIds.push(sub.id);
      }

      for (const id of staleIds) {
        batch.delete(db.collection("pushSubscriptions").doc(id));
      }

      batch.set(
        doc.ref,
        {
          nextRunAt: new Date(nextRun),
          lastNotifiedAt: now,
          updatedAt: now,
        },
        { merge: true },
      );
    }

    await batch.commit();
  } catch (err) {
    console.error("[reminder] scheduler tick failed:", (err as Error)?.message || err);
  } finally {
    running = false;
  }
}