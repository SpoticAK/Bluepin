/**
 * Browser push notification opt-in, delivered via Firebase Cloud Messaging.
 *
 * The FCM token identifies a browser + service-worker installation, so a user
 * who signs in on a phone and a laptop holds two tokens. Tokens are registered
 * through the authenticated API (server/routes/notifications.ts) rather than
 * written to Firestore directly, because the reminder doc is keyed by WhatsApp
 * phone while tokens are keyed by user id.
 *
 * Note: Web Push on iOS only works from an installed PWA (iOS 16.4+), never from
 * a Safari browser tab. `supportsPush` below deliberately reports that as
 * unsupported so the UI can explain it instead of silently failing.
 */
import { getPushMessaging, auth } from "./firebase";
import { deleteToken, getToken } from "firebase/messaging";

/** Where a tapped notification should navigate. Must be same-origin. */
export const NOTIFICATION_TARGET_URL = "/";

/** Reason codes the settings UI branches on. */
export type PushAvailability =
  | "unsupported" // browser or platform cannot do web push at all
  | "insecure" // page is not a secure context (http, except localhost)
  | "ios-needs-install" // iOS Safari tab: works only as an installed PWA
  | "ready"; // getToken() can be called

export function detectPushAvailability(): PushAvailability {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  if (!window.isSecureContext) return "insecure";

  // An iOS user who has not added the PWA to their home screen will have the
  // Push API present but permission permanently denied, with no way to prompt.
  const isIos = /iP(hone|ad|od)/.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ??
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (isIos && !standalone) return "ios-needs-install";

  return "ready";
}

/**
 * Asks the browser for permission.
 *
 * Must be called from a user gesture — Chrome and Safari both ignore
 * `requestPermission()` calls made during page load, so nothing here may run in
 * an effect on mount.
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

/**
 * Registers this browser's FCM token with the server.
 *
 * Returns the new permission state so the caller can render an accurate message;
 * a granted permission with a failed registration is still reported as granted,
 * since the browser side genuinely succeeded.
 */
export async function registerPushToken(): Promise<{
  permission: NotificationPermission;
  registered: boolean;
  error?: string;
}> {
  const permission = await requestPushPermission();
  if (permission !== "granted") {
    return { permission, registered: false };
  }

  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    return { permission, registered: false, error: "Please sign in again." };
  }

  const messaging = await getPushMessaging();
  if (!messaging) {
    return {
      permission,
      registered: false,
      error: "This browser cannot receive notifications.",
    };
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim();
  if (!vapidKey) {
    // Failing loudly beats registering nothing and appearing to succeed.
    return {
      permission,
      registered: false,
      error: "Push notifications are not configured on this server.",
    };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const fcmToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!fcmToken) {
      return {
        permission,
        registered: false,
        error: "Could not create a notification token.",
      };
    }

    const res = await fetch("/api/notifications/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: fcmToken }),
    });

    if (!res.ok) {
      return {
        permission,
        registered: false,
        error: "Could not save your notification token.",
      };
    }

    // Enable the server-side flag that actually causes the cron to send.
    const enableRes = await fetch("/api/notifications/push", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: true }),
    });

    return {
      permission,
      registered: enableRes.ok,
      error: enableRes.ok
        ? undefined
        : "Notifications are on, but the reminder could not be enabled.",
    };
  } catch (err: any) {
    return {
      permission,
      registered: false,
      error: err?.message || "Something went wrong enabling notifications.",
    };
  }
}

/** Turns notifications off: deletes this browser's token and clears the flag. */
export async function unregisterPushToken(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return { ok: false, error: "Please sign in again." };

    const messaging = await getPushMessaging();
    if (messaging) {
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim();
      if (vapidKey) {
        const registration = await navigator.serviceWorker.ready;
        const fcmToken = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: registration,
        });
        if (fcmToken) {
          // deleteToken takes only the Messaging instance — it looks the token
          // up internally, which resolves to the same token fetched above.
          await deleteToken(messaging).catch(() => undefined);
          // Best-effort server cleanup; the local token is gone regardless.
          await fetch("/api/notifications/push", {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token: fcmToken }),
          }).catch(() => undefined);
        }
      }
    }

    const res = await fetch("/api/notifications/push", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: false }),
    });

    return res.ok ? { ok: true } : { ok: false, error: "Could not turn off notifications." };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || "Something went wrong turning off notifications.",
    };
  }
}