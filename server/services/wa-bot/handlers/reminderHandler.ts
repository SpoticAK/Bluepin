import { getAdminFirestore } from "../../../firebase";
import { getUidByPhone } from "../services/glucoseService";
import {
  sendReminderSetupPrompt,
  sendReminderConfirmation,
} from "../wa-client";
import { sendTextMessage } from "../wa-client";

// 10 reminder time slots — must match the list row IDs in reminders.ts
const REMINDER_OPTIONS: Record<string, { hour: number; display: string }> = {
  remind_6:  { hour: 6,  display: "6:00 AM"  },
  remind_7:  { hour: 7,  display: "7:00 AM"  },
  remind_8:  { hour: 8,  display: "8:00 AM"  },
  remind_9:  { hour: 9,  display: "9:00 AM"  },
  remind_12: { hour: 12, display: "12:00 PM" },
  remind_13: { hour: 13, display: "1:00 PM"  },
  remind_18: { hour: 18, display: "6:00 PM"  },
  remind_19: { hour: 19, display: "7:00 PM"  },
  remind_20: { hour: 20, display: "8:00 PM"  },
  remind_21: { hour: 21, display: "9:00 PM"  },
};

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
  const option = REMINDER_OPTIONS[listId];
  if (!option) return; // Not a reminder list item

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
