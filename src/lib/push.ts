import { auth } from "./firebase";

export type PushPermission =
  | "granted"
  | "denied"
  | "default"
  | "unsupported";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getNotificationPermission(): PushPermission {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission as PushPermission;
}

export async function requestNotificationPermission(): Promise<PushPermission> {
  if (!isPushSupported()) return "unsupported";
  return (await Notification.requestPermission()) as PushPermission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getFirebaseToken(): Promise<string> {
  const current = auth.currentUser;
  if (!current) throw new Error("Sign in required");
  return current.getIdToken();
}

async function apiCall(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getFirebaseToken();
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

export async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch("/api/reminders/vapid-public-key");
  if (!res.ok) throw new Error("Could not fetch push setup");
  const data = await res.json();
  return (data as { publicKey: string }).publicKey;
}

async function getExistingSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export interface EnsurePushResult {
  subscribed: boolean;
  permission: PushPermission;
}

/**
 * Ensures the current device is subscribed to push and the subscription is
 * registered on the server. Does nothing (returns permission state) unless the
 * user has already granted permission.
 */
export async function ensurePushSubscription(): Promise<EnsurePushResult> {
  const permission = getNotificationPermission();
  if (!isPushSupported() || permission !== "granted") {
    return { subscribed: false, permission };
  }

  let sub = await getExistingSubscription();
  if (!sub) {
    const vapidKey = await fetchVapidPublicKey();
    const reg = await navigator.serviceWorker.ready;
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  const normalized = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const res = await apiCall("/api/reminders/subscribe", {
    method: "POST",
    body: JSON.stringify({ subscription: normalized }),
  });
  if (!res.ok) throw new Error("Failed to register for notifications");
  return { subscribed: true, permission };
}

/** Removes the push subscription both locally and on the server. */
export async function disablePushSubscription(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  try {
    await apiCall("/api/reminders/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } catch (e) {
    console.warn("Failed to remove subscription on server", e);
  }
  await sub.unsubscribe().catch((e) => console.warn("push unsubscribe failed", e));
}

/** Sends a test notification from the server to this user. */
export async function sendTestNotification(): Promise<void> {
  const res = await apiCall("/api/reminders/test", { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || "Failed to send test notification");
  }
}