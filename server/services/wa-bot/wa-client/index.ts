// Re-export everything handlers need — handlers import from "wa-client", not from deep paths.
export { sendTextMessage } from "./messages/common";
export {
  sendGlucoseTimingPrompt,
  sendGlucoseLogConfirmation,
  sendInvalidGlucoseResponse,
  sendNoPendingReadingResponse,
} from "./messages/glucose";
export {
  sendInitialGreeting,
  sendHelpMessage,
  sendUnknownInputMessage,
  sendViewHealthProfileCta,
} from "./messages/default";
export {
  sendReportAcceptedCta,
  sendInvalidReportMessage,
} from "./messages/reports";
export {
  sendReminderSetupPrompt,
  sendReminderConfirmation,
} from "./messages/reminders";
