import { postMessage } from "../sender";

// 10 common reminder time slots
const REMINDER_ROWS = [
  { id: "remind_6",  title: "6:00 AM",  },
  { id: "remind_7",  title: "7:00 AM",  },
  { id: "remind_8",  title: "8:00 AM",  },
  { id: "remind_9",  title: "9:00 AM",  },
  { id: "remind_12", title: "12:00 PM", },
  { id: "remind_13", title: "1:00 PM",  },
  { id: "remind_18", title: "6:00 PM",  },
  { id: "remind_19", title: "7:00 PM",  },
  { id: "remind_20", title: "8:00 PM",  },
  { id: "remind_21", title: "9:00 PM",  },
];

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
