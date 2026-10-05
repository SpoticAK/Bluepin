/**
 * Browser push delivery for the daily glucose reminder.
 *
 * Firebase Cloud Messaging is used rather than raw Web Push because both the
 * client (`firebase/messaging`) and the server (`firebase-admin/messaging`) are
 * already dependencies, which means VAPID key handling, payload encryption and
 * token rotation are handled for us.
 *
 * Token lifecycle: an FCM token can be invalidated by the browser at any time
 * (user clears site data, revokes permission, uninstalls the PWA). FCM reports
 * that as `messaging/registration-token-not-registered`, so those docs are
 * deleted rather than retried forever — otherwise the collection grows unbounded
 * and every send pays for dead tokens.
 */
import { getAdminFirestore, getAdminApp } from "../firebase";
import { getMessaging } from "firebase-admin/messaging";

/** Where a tapped notification should send the user. */
const TARGET_URL = "/";

/** Firebase codes that mean "this token is dead, stop using it". */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export interface PushResult {
  /** Recipients the notification was successfully delivered to. */
  delivered: number;
  /** Documents removed because their token was reported invalid. */
  prunedTokens: number;
  /** Per-recipient failures that were not fatal to the run. */
  errors: number;
}

/**
 * The notification payload without any targeting field.
 *
 * `Message` is a discriminated union where every variant requires one of
 * `token`/`tokens`/`topic`/`condition`, so the reusable part is spelled out as
 * an Omit rather than fighting the union at each call site.
 */
type UntargetedMessage = Omit<
  import("firebase-admin/messaging").TokenMessage,
  "token"
>;

function buildMessage(): UntargetedMessage {
  return {
    // Both `notification` and `data` are set: `notification` renders the system
    // banner via the service worker's push handler, while `data` carries what
    // the click handler needs.
    notification: {
      title: "Time to log your glucose",
      body: "A quick reading now keeps your daily picture complete.",
    },
    data: {
      tag: "bluepin-glucose-reminder",
      url: TARGET_URL,
    },
    webpush: {
      // Note: for Web Push, FCM's own `notification` block is what the browser
      // renders. The presentation options below therefore belong on
      // `webpush.notification` — setting them on `webpush` directly is a type
      // error, and putting them in `data` would just ship as opaque strings.
      notification: {
        icon: "/pwa-192x192.png",
        badge: "/bluepin-96.webp",
        // Collapse repeat nudges rather than stacking identical notifications.
        tag: "bluepin-glucose-reminder",
        renotify: true,
        vibrate: [100, 50, 100] as number[],
      },
    },
  };
}

/**
 * Sends the reminder to every opted-in user whose reminder hour matches.
 *
 * Callers are responsible for the "already logged today" check — this function
 * sends to whoever it is told to, matching the WhatsApp path's separation of
 * concerns.
 *
 * @param matchingDocs Reminder documents already filtered to the current hour
 *                     and to users who have not logged today.
 */
export async function sendGlucosePushNudges(
  matchingDocs: Array<{ uid: string }>,
): Promise<PushResult> {
  const result: PushResult = { delivered: 0, prunedTokens: 0, errors: 0 };
  if (matchingDocs.length === 0) return result;

  const db = getAdminFirestore();

  // Resolve lazily: a project without messaging enabled would otherwise throw at
  // import time and take down the whole server, including WhatsApp reminders.
  let messaging;
  try {
    messaging = getMessaging(getAdminApp());
  } catch (err: any) {
    console.error("[Push] Firebase Messaging unavailable, skipping push send:", err?.message || err);
    return result;
  }

  for (const { uid } of matchingDocs) {
    const tokensRef = db.collection(`users/${uid}/fcmTokens`);
    const tokensSnap = await tokensRef.get();

    if (tokensSnap.empty) continue;

    const tokens = tokensSnap.docs
      .map((d) => d.data()?.token)
      .filter((t): t is string => typeof t === "string" && t.length > 0);

    if (tokens.length === 0) continue;

    try {
      const response = await messaging.sendEachForMulticast({
        ...buildMessage(),
        tokens,
      });

      result.delivered += response.successCount;
      result.errors += response.failureCount;

      // Re-read each failed response's token so the right doc gets pruned.
      response.responses.forEach((r, index) => {
        if (r.success || !r.error) return;
        const code = r.error?.code || "";
        if (!DEAD_TOKEN_CODES.has(code)) return;

        const token = tokens[index];
        const doc = tokensSnap.docs.find((d) => d.data()?.token === token);
        if (!doc) return;

        doc.ref.delete().catch((err) =>
          console.warn("[Push] Failed to prune stale token:", err?.message || err),
        );
        result.prunedTokens++;
      });
    } catch (err: any) {
      // A malformed payload or misconfigured project would throw here. Log and
      // continue to the next user rather than aborting the whole sweep.
      console.error(`[Push] Failed to send to user ${uid}:`, err?.message || err);
      result.errors++;
    }
  }

  return result;
}