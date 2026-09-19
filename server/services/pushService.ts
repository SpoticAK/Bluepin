import webpush from "web-push";
import type { PushSubscription } from "web-push";
import { getVapidKeys, getVapidSubject } from "../vapid";

export interface PushPayload {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  vibrate?: number[];
  requireInteraction?: boolean;
}

export type SendPushResult = { ok: true; statusCode: number } | { ok: false; dropped: true; statusCode?: number };

/**
 * Sends a push message. Returns { dropped: true } when the push service reports
 * the subscription is no longer valid (404/410), so callers can clean it up.
 */
export async function sendPush(
  subscription: PushSubscription,
  payload: PushPayload,
): Promise<SendPushResult> {
  const vapid = getVapidKeys();
  try {
    const res = await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: getVapidSubject(),
          publicKey: vapid.publicKey,
          privateKey: vapid.privateKey,
        },
        // Keep the message for up to 12 hours so a briefly-offline device still gets it.
        TTL: 60 * 60 * 12,
        urgency: payload.requireInteraction ? "high" : "normal",
      },
    );
    return { ok: true, statusCode: res.statusCode };
  } catch (err) {
    if (err instanceof webpush.WebPushError) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        return { ok: false, dropped: true, statusCode: err.statusCode };
      }
      console.error("[push] push service error", {
        statusCode: err.statusCode,
        endpoint: err.endpoint,
        body: err.body,
      });
    } else {
      console.error("[push] failed to send notification:", (err as Error)?.message || err);
    }
    throw err;
  }
}