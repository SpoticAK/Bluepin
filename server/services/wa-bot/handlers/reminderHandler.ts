import { getAdminFirestore } from "../../../firebase";
import { getUidByPhone } from "../services/glucoseService";
import {
  sendReminderSetupPrompt,
  sendReminderConfirmation,
} from "../wa-client";
import { sendTextMessage } from "../wa-client";

// WhatsApp doesn't have a native time picker.
// The best UX is offering common times as 3 quick-reply buttons.
const REMINDER_OPTIONS: Record<string, { hour: number; display: string }> = {
  remind_8: { hour: 8, display: "8:00 AM" },
  remind_13: { hour: 13, display: "1:00 PM" },
  remind_20: { hour: 20, display: "8:00 PM" },
};

/**
 * Step 1: Shows the reminder setup options.
 * Triggered from the main menu "Set a reminder" option.
 */
export async function handleReminderPrompt(sender: string): Promise<void> {
  const uid = await getUidByPhone(sender);
  if (!uid) {
    await sendTextMessage(
      sender,
      "⏰ To set a reminder, your WhatsApp must be linked to a Bluepin account.\n\n" +
      "Open the Bluepin app to link your number, then try again.",
    );
    return;
  }

  await sendReminderSetupPrompt(sender);
}

/**
 * Step 2: Processes the button tap and saves to Firestore.
 * Triggered when a user taps one of the "remind_*" buttons.
 */
export async function handleReminderSelection(
  sender: string,
  buttonId: string,
): Promise<void> {
  const option = REMINDER_OPTIONS[buttonId];
  if (!option) return; // Not a reminder button

  const uid = await getUidByPhone(sender);
  if (!uid) {
    // Failsafe in case they unlinked between prompting and tapping
    return;
  }

  const db = getAdminFirestore();

  // Save to the exact collection expected by Bluepin's existing cron route
  await db.doc(`whatsapp_reminders/${sender}`).set({
    uid,
    phone: sender,
    reminderHour: option.hour,
    displayTime: option.display,
    updatedAt: new Date(),
  });

  await sendReminderConfirmation(sender, option.display);
}
