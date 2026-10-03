import { getAdminFirestore } from "../../../firebase";
import { getUidByPhone } from "../services/glucoseService";
import { getSlotByRowId } from "../services/reminderSlots";
import {
  sendReminderSetupPrompt,
  sendReminderConfirmation,
} from "../wa-client";
import { sendTextMessage } from "../wa-client";

/**
 * Step 1: Shows the reminder time picker list.
 * Triggered from the main menu "Set a reminder" option.
 */
export async function handleReminderPrompt(sender: string): Promise<void> {
  const uid = await getUidByPhone(sender);
  if (!uid) {
    await sendTextMessage(
      sender,
      "To set a reminder, your WhatsApp must be linked to a Bluepin account.\n\n" +
        "Open the Bluepin app to link your number, then try again.",
    );
    return;
  }

  await sendReminderSetupPrompt(sender);
}

/**
 * Step 2: Processes the list selection and saves to Firestore.
 * Triggered when a user picks one of the "remind_*" list items.
 */
export async function handleReminderSelection(
  sender: string,
  listId: string,
): Promise<void> {
  const option = getSlotByRowId(listId);
  if (!option) return; // Not a reminder list item

  const uid = await getUidByPhone(sender);
  if (!uid) {
    // Failsafe in case they unlinked between prompting and tapping
    return;
  }

  const db = getAdminFirestore();

  // Save to the exact collection expected by Bluepin's existing cron route.
  // Selecting a time is an explicit opt-in, so it also re-enables a reminder
  // the user previously stopped from the app.
  await db.doc(`whatsapp_reminders/${sender}`).set({
    uid,
    phone: sender,
    reminderHour: option.hour,
    displayTime: option.display,
    enabled: true,
    updatedAt: new Date(),
  });

  await sendReminderConfirmation(sender, option.display);
}
