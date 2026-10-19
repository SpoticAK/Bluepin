import { describe, expect, it } from "vitest";
import { getCareReminders } from "./careReminderRules";

// Fixed "now": Wednesday 2026-10-14 08:00 local (before the 10:00 fasting cutoff,
// before the 14:00 post-meal hour).
const NOW = new Date(2026, 9, 14, 8, 0, 0);
const iso = (dayOffset: number, h = 8, m = 0) => {
  const d = new Date(2026, 9, 14 + dayOffset, h, m, 0);
  return d.toISOString();
};

describe("getCareReminders — glucose", () => {
  it("returns nothing glucose-related when tracking is disabled", () => {
    const out = getCareReminders({ now: NOW, glucoseTrackingEnabled: false });
    expect(out.filter((r) => r.action === "log_glucose")).toHaveLength(0);
  });

  it("prompts fasting log before the cutoff when nothing logged today", () => {
    const out = getCareReminders({ now: NOW, glucoseTrackingEnabled: true, glucoseReadings: [] });
    const fasting = out.find((r) => r.type === "glucose_fasting");
    expect(fasting?.title).toBe("Log your fasting glucose");
    // Empty history also yields the "start tracking" nudge
    expect(out.some((r) => r.type === "glucose_missed_days")).toBe(true);
  });

  it("reports a missed fasting after the cutoff", () => {
    const late = new Date(2026, 9, 14, 11, 0, 0);
    const out = getCareReminders({ now: late, glucoseTrackingEnabled: true, glucoseReadings: [] });
    expect(out.find((r) => r.type === "glucose_fasting")?.title).toBe(
      "Fasting glucose missed today",
    );
  });

  it("stays quiet when fasting is already logged today", () => {
    const out = getCareReminders({
      now: NOW,
      glucoseTrackingEnabled: true,
      glucoseReadings: [{ timestamp: iso(0, 7, 30), timing: "Fasting" }],
    });
    expect(out.some((r) => r.type === "glucose_fasting")).toBe(false);
  });

  it("counts consecutive missed days", () => {
    const out = getCareReminders({
      now: NOW,
      glucoseTrackingEnabled: true,
      glucoseReadings: [{ timestamp: iso(-3, 8), timing: "Fasting" }],
    });
    const missed = out.find((r) => r.type === "glucose_missed_days");
    expect(missed?.message).toContain("2 days");
  });

  it("asks for post-meal only after 14:00 when missing", () => {
    const afternoon = new Date(2026, 9, 14, 15, 0, 0);
    const out = getCareReminders({
      now: afternoon,
      glucoseTrackingEnabled: true,
      glucoseReadings: [{ timestamp: iso(0, 7, 30), timing: "Fasting" }],
    });
    expect(out.some((r) => r.type === "glucose_post_meal")).toBe(true);

    const morningOut = getCareReminders({
      now: NOW,
      glucoseTrackingEnabled: true,
      glucoseReadings: [{ timestamp: iso(0, 7, 30), timing: "Fasting" }],
    });
    expect(morningOut.some((r) => r.type === "glucose_post_meal")).toBe(false);
  });
});

describe("getCareReminders — weight", () => {
  it("asks for the first weight log when none exists", () => {
    const out = getCareReminders({ now: NOW, weightLogs: [] });
    expect(out.find((r) => r.type === "weight")?.title).toBe("Log your weight");
  });

  it("stays quiet within the 7-day window", () => {
    const out = getCareReminders({ now: NOW, weightLogs: [{ timestamp: iso(-3) }] });
    expect(out.some((r) => r.type === "weight")).toBe(false);
  });

  it("reports overdue days past the window", () => {
    const out = getCareReminders({ now: NOW, weightLogs: [{ timestamp: iso(-10) }] });
    expect(out.find((r) => r.type === "weight")?.message).toContain("3 days overdue");
  });

  it("ignores weight entirely when logs are undefined", () => {
    expect(getCareReminders({ now: NOW }).some((r) => r.type === "weight")).toBe(false);
  });
});

describe("getCareReminders — health reports", () => {
  it("asks for the first report when none exists", () => {
    const out = getCareReminders({ now: NOW, healthReports: [] });
    expect(out.find((r) => r.type === "health_report")?.title).toBe("Upload your health report");
  });

  it("uses a 12-month cadence for good scores", () => {
    const elevenMonthsAgo = new Date(2026, 9 - 11, 14, 8, 0, 0).toISOString();
    const out = getCareReminders({
      now: NOW,
      healthScore: 90,
      healthReports: [{ uploadedAt: elevenMonthsAgo }],
    });
    expect(out.some((r) => r.type === "health_report")).toBe(false);
  });

  it("uses a 6-month cadence for scores below 80", () => {
    const sevenMonthsAgo = new Date(2026, 9 - 7, 14, 8, 0, 0).toISOString();
    const out = getCareReminders({
      now: NOW,
      healthScore: 70,
      healthReports: [{ uploadedAt: sevenMonthsAgo }],
    });
    const reminder = out.find((r) => r.type === "health_report");
    expect(reminder?.message).toContain("6 months");
  });
});
