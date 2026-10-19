import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateBMI,
  cn,
  getBMICategory,
  istTime,
  istToday,
  safeFormat,
  trackEvent,
} from "./utils";

describe("cn", () => {
  it("merges class names with tailwind conflict resolution", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});

describe("calculateBMI / getBMICategory", () => {
  it("computes BMI to one decimal", () => {
    expect(calculateBMI(70, 175)).toBe(22.9);
    expect(calculateBMI(70, 0)).toBe(0);
  });

  it("categorises with Asian cutoffs", () => {
    expect(getBMICategory(17)).toBe("Underweight");
    expect(getBMICategory(22)).toBe("Normal weight");
    expect(getBMICategory(25)).toBe("Overweight");
    expect(getBMICategory(30)).toBe("Obese");
  });
});

describe("safeFormat", () => {
  it("formats ISO strings and Dates", () => {
    expect(safeFormat("2026-10-14T08:00:00.000Z", "yyyy-MM-dd")).toBe("2026-10-14");
    expect(safeFormat(new Date(2026, 9, 14), "yyyy-MM-dd")).toBe("2026-10-14");
  });

  it("returns empty string for missing/invalid input", () => {
    expect(safeFormat(undefined, "yyyy-MM-dd")).toBe("");
    expect(safeFormat(null, "yyyy-MM-dd")).toBe("");
    expect(safeFormat("not-a-date", "yyyy-MM-dd")).toBe("");
  });
});

describe("istToday / istTime", () => {
  it("derives IST day/time from a fixed-offset shift", () => {
    // 2026-10-14 00:30 UTC == 06:00 IST same date
    const d = new Date("2026-10-14T00:30:00.000Z");
    expect(istToday(d)).toBe("2026-10-14");
    expect(istTime(d)).toBe("06:00");
    // 2026-10-13 20:00 UTC == 2026-10-14 01:30 IST (day rolls over)
    expect(istToday(new Date("2026-10-13T20:00:00.000Z"))).toBe("2026-10-14");
  });
});

describe("trackEvent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is a no-op without window", () => {
    vi.stubGlobal("window", undefined);
    expect(() => trackEvent("x")).not.toThrow();
  });

  it("pushes to dataLayer when window exists", () => {
    const dl: unknown[] = [];
    vi.stubGlobal("window", { dataLayer: dl });
    trackEvent("login", { method: "otp" });
    expect(dl).toEqual([{ event: "login", method: "otp" }]);
  });
});
