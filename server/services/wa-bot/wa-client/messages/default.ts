import { postMessage } from "../sender";

// Which description variant to use for "Upload health report"
type MenuVariant = "standard" | "help";

const MENU_BUTTON_TEXT = "See options"; // max 20 chars

const APP_URL =
  "https://bluepin-app-preview--myhealthyfam-28c2c.asia-southeast1.hosted.app";

const HEALTH_PROFILE_HEADER_IMAGE =
  process.env.HEALTH_PROFILE_HEADER_IMAGE_URL ??
  "https://placehold.co/800x418/0D9488/ffffff?text=Your+Health+Profile";

function getMenuBullets(variant: MenuVariant = "standard") {
  const reportDesc =
    variant === "help"
      ? "Send me a PDF health report under 5 MB."
      : "Send me your health reports and I will add them to your health profile.";

  return (
    "\n\n• *Log glucose*: Send me a reading or a photo of your glucometer." +
    `\n• *Upload health report*: ${reportDesc}` +
    "\n• *Set a reminder*: Choose when you would like me to remind you to log your glucose." +
    "\n• *View health profile*: See your health history, trends and personalised insights."
  );
}

const MENU_ROWS = [
  {
    id: "log_glucose",
    title: "Log glucose",
  },
  {
    id: "upload_report",
    title: "Upload health report",
  },
  {
    id: "set_reminder",
    title: "Set a reminder",
  },
  {
    id: "view_profile",
    title: "View health profile",
  },
];

type ListMessageOptions = {
  to: string;
  header?: string;
  body: string;
  footer: string;
};

function buildListPayload({ to, header, body, footer }: ListMessageOptions) {
  const interactive: Record<string, unknown> = {
    type: "list",
    body: { text: body },
    footer: { text: footer },
    action: {
      button: MENU_BUTTON_TEXT,
      sections: [{ rows: MENU_ROWS }],
    },
  };

  if (header) {
    interactive.header = { type: "text", text: header };
  }

  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive,
  });
}

/**
 * Sent when a user opens the bot for the very first time (triggered from app on signup).
 */
export async function sendInitialGreeting(to: string): Promise<Response> {
  return buildListPayload({
    to,
    header: "Hi, I am Aarika from Bluepin. 🙏",
    body:
      "I will be your WhatsApp companion for managing your diabetes, right here every day.\n\n" +
      "Here is what I can help you with:" +
      getMenuBullets("standard"),
    footer: "Type help if you need anything.",
  });
}

/**
 * Sent in reply to the user typing "help".
 * Note: support email is in body — WA footer has a strict ~60-char limit.
 */
export async function sendHelpMessage(to: string): Promise<Response> {
  return buildListPayload({
    to,
    body:
      "Of course. Here is what I can help you with:" +
      getMenuBullets("help") +
      "\n\nNeed to speak to someone?\nEmail sparsh@bluepin.in and we will get back to you within 24 hours.",
    footer: "Type help if you need anything.",
  });
}

/**
 * Sent when the user's input is not recognised by the bot.
 */
export async function sendUnknownInputMessage(to: string): Promise<Response> {
  return buildListPayload({
    to,
    body:
      "Hi, I am Aarika from Bluepin.\n\n" +
      "Here is what I can help you with:" +
      getMenuBullets("standard"),
    footer: "Type help if you need anything.",
  });
}

/**
 * Sent when the user selects "View health profile" from the menu.
 *
 * Uses a CTA URL button with an image header.
 *
 * --- Image guidance ---
 * Dimensions : 800 × 418 px  (WhatsApp standard header, 1.91:1 ratio)
 * Format     : JPEG or PNG, under 5 MB
 * Style      : Clean, minimal health-dashboard feel. Suggestions:
 *   - A soft teal/blue gradient with a subtle glucose trend line drawn in white
 *   - A top-down flatlay of a glucometer, phone, and a notebook on a light background
 *   - Abstract circular chart rings in your brand colours (teal #0D9488, white, slate)
 *   - Keep text in the image to a minimum — WhatsApp compresses headers aggressively
 * Tools      : Canva ("Health Dashboard Banner" template) or generate with
 *              AI (Midjourney/Ideogram prompt: "minimal health analytics banner,
 *              teal and white, glucose graph, clean, no text, 800x418")
 * Hosting    : Upload to Firebase Storage / S3 / Cloudinary → set the public URL
 *              as HEALTH_PROFILE_HEADER_IMAGE_URL in your .env
 */
export async function sendViewHealthProfileCta(to: string): Promise<Response> {
  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      //   header: {
      //     type: "image",
      //     image: { link: HEALTH_PROFILE_HEADER_IMAGE },
      //   },
      body: {
        text: "Your health history, trends and personalised insights are ready to view.",
      },
      action: {
        name: "cta_url",
        parameters: {
          display_text: "View health profile",
          url: APP_URL,
        },
      },
      footer: { text: "Type help if you need anything." },
    },
  });
}
