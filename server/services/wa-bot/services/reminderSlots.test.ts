import { describe, expect, it } from "vitest";
import {
  APP_HOUR_MAX,
  APP_HOUR_MIN,
  APP_REMINDER_HOURS,
  REMINDER_SLOTS,
  formatHour,
  getSlotByHour,
  getSlotByRowId,
  isValidAppHour,
} from "./reminderSlots";

describe("REMINDER_SLOTS (WhatsApp bot list)", () => {
  it("never exceeds Meta's 10-row interactive-list cap", () => {
    expect(REMINDER_SLOTS.length).toBeLessThanOrEqual(10);
  });

  it("has unique hours and row ids", () => {
    expect(new Set(REMINDER_SLOTS.map((s) => s.hour)).size).toBe(REMINDER_SLOTS.length);
    expect(new Set(REMINDER_SLOTS.map((s) => s.rowId)).size).toBe(REMINDER_SLOTS.length);
  });

  it("keeps every hour inside 0-23", () => {
    for (const s of REMINDER_SLOTS) {
      expect(s.hour).toBeGreaterThanOrEqual(0);
      expect(s.hour).toBeLessThanOrEqual(23);
    }
  });
});

describe("APP_REMINDER_HOURS (web app picker)", () => {
  it("covers every hour from APP_HOUR_MIN to APP_HOUR_MAX", () => {
    expect(APP_HOUR_MIN).toBe(5);
    expect(APP_HOUR_MAX).toBe(23);
    expect(APP_REMINDER_HOURS).toHaveLength(APP_HOUR_MAX - APP_HOUR_MIN + 1);
    expect(APP_REMINDER_HOURS[0].hour).toBe(APP_HOUR_MIN);
    expect(APP_REMINDER_HOURS.at(-1)!.hour).toBe(APP_HOUR_MAX);
  });
});

describe("isValidAppHour", () => {
  it("accepts the boundary hours", () => {
    expect(isValidAppHour(5)).toBe(true);
    expect(isValidAppHour(23)).toBe(true);
  });

  it("rejects out-of-range, fractional and non-numeric input — including 0", () => {
    expect(isValidAppHour(0)).toBe(false);
    expect(isValidAppHour(4)).toBe(false);
    expect(isValidAppHour(24)).toBe(false);
    expect(isValidAppHour(7.5)).toBe(false);
    expect(isValidAppHour("7")).toBe(false);
    expect(isValidAppHour(null)).toBe(false);
    expect(isValidAppHour(undefined)).toBe(false);
  });
});

describe("getSlotByRowId / getSlotByHour", () => {
  it("resolves known ids and hours", () => {
    expect(getSlotByRowId("remind_6")).toMatchObject({ hour: 6 });
    expect(getSlotByHour(20)).toMatchObject({ rowId: "remind_20" });
  });

  it("returns null for unknown ids and hours", () => {
    expect(getSlotByRowId("remind_99")).toBeNull();
    expect(getSlotByRowId("")).toBeNull();
    expect(getSlotByHour(3)).toBeNull();
  });
});

describe("formatHour", () => {
  it("uses curated labels for known slots", () => {
    expect(formatHour(6)).toBe("6:00 AM");
    expect(formatHour(12)).toBe("12:00 PM");
    expect(formatHour(21)).toBe("9:00 PM");
  });

  it("falls back to computed labels for unlisted hours", () => {
    expect(formatHour(0)).toBe("12:00 AM");
    expect(formatHour(3)).toBe("3:00 AM");
    expect(formatHour(15)).toBe("3:00 PM");
    expect(formatHour(23)).toBe("11:00 PM");
  });
});
