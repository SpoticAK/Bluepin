import { postMessage } from "../sender";

/**
 * Sends a 3-button interactive message asking the user to choose a reminder time.
 */
export async function sendReminderSetupPrompt(to: string): Promise<Response> {
  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "text",
        text: "Reminder Setup",
      },
      body: {
        text: "When would you like me to remind you to log your glucose?\nChoose a time below and I will remember it for you.",
      },
      footer: {
        text: "Type help if you need anything.",
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: "remind_8", title: "8:00 AM" } },
          { type: "reply", reply: { id: "remind_13", title: "1:00 PM" } },
          { type: "reply", reply: { id: "remind_20", title: "8:00 PM" } },
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
