/**
 * Daily-reminder time options.
 *
 * Two separate surfaces, deliberately not unified:
 *
 * - REMINDER_SLOTS is the WhatsApp bot's list. WhatsApp caps interactive lists
 *   at 10 rows total, so this can never exceed 10 entries no matter what the
 *   app offers.
 * - APP_REMINDER_HOURS is the web app's picker. It is a range, not a table,
 *   because the app has no row limit.
 *
 * Both write the same `reminderHour` field, so a time set on one surface is
 * simply a time the other cannot always express.
 *
 * Hours are interpreted in IST by the cron route — see server/routes/cron.ts.
 */

export interface ReminderSlot {
  /** 0-23 hour in IST. Stored as `reminderHour` on the reminder doc. */
  hour: number;
  /** Human-readable label, e.g. "6:00 AM". Stored as `displayTime`. */
  display: string;
  /** WhatsApp interactive-list row id, and the bot's selection key. */
  rowId: string;
}

/** The app's picker option. No rowId: the app never sends one. */
export interface ReminderHour {
  /** 0-23 hour in IST. */
  hour: number;
  /** Human-readable label, e.g. "7:00 AM". */
  display: string;
}

/**
 * The 10 curated times offered over WhatsApp.
 *
 * The 10-row ceiling is a Meta platform limit, not a product preference, so
 * these stay hand-curated for plausibility rather than being derived from the
 * app's range.
 */
export const REMINDER_SLOTS: readonly ReminderSlot[] = [
  { rowId: "remind_6",  hour: 6,  display: "6:00 AM"  },
  { rowId: "remind_7",  hour: 7,  display: "7:00 AM"  },
  { rowId: "remind_8",  hour: 8,  display: "8:00 AM"  },
  { rowId: "remind_9",  hour: 9,  display: "9:00 AM"  },
  { rowId: "remind_12", hour: 12, display: "12:00 PM" },
  { rowId: "remind_13", hour: 13, display: "1:00 PM"  },
  { rowId: "remind_18", hour: 18, display: "6:00 PM"  },
  { rowId: "remind_19", hour: 19, display: "7:00 PM"  },
  { rowId: "remind_20", hour: 20, display: "8:00 PM"  },
  { rowId: "remind_21", hour: 21, display: "9:00 PM"  },
] as const;

/**
 * Inclusive bounds of the app's picker.
 *
 * The upper bound stops at 11 PM rather than midnight because there is no
 * product sense in nudging someone to log glucose at 03:00. The lower bound
 * is 5 AM for the same reason.
 */
export const APP_HOUR_MIN = 5;
export const APP_HOUR_MAX = 23;

/** Every hour the app offers, 5:00 AM through 11:00 PM. */
export const APP_REMINDER_HOURS: readonly ReminderHour[] = Array.from(
  { length: APP_HOUR_MAX - APP_HOUR_MIN + 1 },
  (_, i) => {
    const hour = APP_HOUR_MIN + i;
    return { hour, display: formatHour(hour) };
  },
);

/**
 * Whether an hour is selectable in the app.
 *
 * Written as an explicit range comparison rather than a truthiness check, so
 * hour 0 is rejected instead of silently falling through.
 */
export function isValidAppHour(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= APP_HOUR_MIN &&
    value <= APP_HOUR_MAX
  );
}

/** Resolves a WhatsApp `remind_*` row id to its slot, or null if unknown. */
export function getSlotByRowId(rowId: string): ReminderSlot | null {
  return REMINDER_SLOTS.find((slot) => slot.rowId === rowId) ?? null;
}

/** Resolves a stored 0-23 `reminderHour` to a bot slot, or null if not offered. */
export function getSlotByHour(hour: number): ReminderSlot | null {
  return REMINDER_SLOTS.find((slot) => slot.hour === hour) ?? null;
}

/**
 * Formats an arbitrary 0-23 hour for display. Falls back for hours outside the
 * curated slot list so a hand-edited or legacy document still renders.
 */
export function formatHour(hour: number): string {
  const known = getSlotByHour(hour);
  if (known) return known.display;

  const normalised = ((Math.trunc(hour) % 24) + 24) % 24;
  const suffix = normalised >= 12 ? "PM" : "AM";
  const twelve = normalised % 12 === 0 ? 12 : normalised % 12;
  return `${twelve}:00 ${suffix}`;
}