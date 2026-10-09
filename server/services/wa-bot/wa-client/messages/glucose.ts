import { postMessage } from "../sender";
import { getDashboardUrl } from "../../services/magicLink";
import { footerText } from "./common";
import type { TimingLabel } from "../../types";

const TIMING_DISPLAY_LABELS: Record<TimingLabel, string> = {
  fasting: "fasting",
  random: "random",
  "post-prandial": "post-meal",
};

/**
 * Sends the interactive button prompt asking when the glucose reading was taken.
 * Called after the user sends a valid glucose number.
 */
export async function sendGlucoseTimingPrompt(
  to: string,
  glucoseValue: number,
): Promise<Response> {
  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: { type: "text", text: "Glucose Reading Accepted" },
      body: {
        text: `I got ${glucoseValue} mg/dL.\n\nOne more thing: when was this taken relative to your last meal or sugary drink?\n\n`,
      },
      footer: { text: footerText },
      action: {
        buttons: [
          { type: "reply", reply: { id: "fasting", title: "Fasting (>8h)" } },
          { type: "reply", reply: { id: "random", title: "Random (2–8h)" } },
          {
            type: "reply",
            reply: { id: "post-prandial", title: "Post meal (<2h)" },
          },
        ],
      },
    },
  });
}

/**
 * Sends the final confirmation after glucose + timing are both logged.
 * Uses the actual values — no hardcoding.
 */
export async function sendGlucoseLogConfirmation(
  to: string,
  glucoseValue: number,
  timing: TimingLabel,
): Promise<Response> {
  const timingLabel = TIMING_DISPLAY_LABELS[timing];
  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      header: { type: "text", text: "Glucose Successfully Logged" },
      body: {
        text: `Got it. I have logged *${glucoseValue} mg/dL* as a *${timingLabel}* reading.\n\nYour health profile is up to date.`,
      },
      action: {
        name: "cta_url",
        parameters: {
          display_text: "View health profile",
          url: getDashboardUrl(),
        },
      },
      footer: { text: footerText },
    },
  });
}

/**
 * Sent when the user's text is not a valid glucose number (out of range or non-numeric).
 */
export async function sendInvalidGlucoseResponse(
  to: string,
): Promise<Response> {
  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      body: `*Invalid Glucose Input*\n\nI could not find a glucose reading in that. 🤔\nSend me the number, like 126, or a photo of your glucometer and I will take it from there.\n\n_${footerText}_`,
    },
  });
}

/**
 * Sent when an uploaded photo is over the size limit. Mirrors the PDF oversize
 * reply so both media types give the same shape of guidance.
 */
export async function sendOversizedImageResponse(to: string): Promise<Response> {
  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      body: `*Photo Too Large*\n\nI could not read that photo. 🤔\nSend me a photo of your glucometer under 5 MB and I will take it from there.\n\n_${footerText}_`,
    },
  });
}

/**
 * Sent when the user taps a timing button but the session has expired or they double-tapped.
 */
export async function sendNoPendingReadingResponse(
  to: string,
): Promise<Response> {
  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      body: `This reading has already been logged or timed out. \n\nTo log a new reading, simply send me the number again.`,
    },
  });
}
