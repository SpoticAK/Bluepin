import { postMessage } from "../sender";
import { REMINDER_SLOTS } from "../../services/reminderSlots";

// 10 common reminder time slots, row ids sourced from the canonical table so
// the picker can never drift from the hours reminderHandler actually stores.
const REMINDER_ROWS = REMINDER_SLOTS.map((slot) => ({
  id: slot.rowId,
  title: slot.display,
}));

/**
 * Sends an interactive list asking the user to pick a daily reminder time.
 * Uses a list (not buttons) so we can offer 10 time slots.
 */
export async function sendReminderSetupPrompt(to: string): Promise<Response> {
  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: "Reminder Setup",
      },
      body: {
        text: "When would you like me to remind you to log your glucose?\nChoose a time below and I will remind you every day.",
      },
      footer: {
        text: "Type help if you need anything.",
      },
      action: {
        button: "Choose a time",
        sections: [
          {
            title: "Daily reminder time",
            rows: REMINDER_ROWS,
          },
        ],
      },
    },
  });
}

/**
 * Sent after the user selects a reminder time.
 */
export async function sendReminderConfirmation(
  to: string,
  displayTime: string,
): Promise<Response> {
  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      body: `Done. I will remind you at ${displayTime} each day.\nI will be here when you are ready to log your reading.\n\nType help if you need anything.`,
    },
  });
}
