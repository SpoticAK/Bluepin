import { describe, expect, it } from "vitest";
import { format, subDays } from "date-fns";
import {
  calculateGoalsStreak,
  getActiveGoalsForDate,
  getWeeklyActivity,
} from "./goalUtils";

const goal = (over: Record<string, unknown>) => ({
  id: "walk",
  isActive: true,
  ...over,
});

const dStr = (daysAgo: number) => format(subDays(new Date(), daysAgo), "yyyy-MM-dd");
const doneLog = (gid: string) => ({ [gid]: { completed: true } });

describe("getActiveGoalsForDate", () => {
  it("returns goals active by default flag", () => {
    const goals = [goal({}), goal({ id: "run", isActive: false })];
    expect(getActiveGoalsForDate(goals, "2026-10-14").map((g) => g.id)).toEqual(["walk"]);
  });

  it("honours activeHistory up to the queried date", () => {
    const goals = [
      goal({ activeHistory: { "2026-10-10": true, "2026-10-12": false } }),
    ];
    expect(getActiveGoalsForDate(goals, "2026-10-11")).toHaveLength(1);
    expect(getActiveGoalsForDate(goals, "2026-10-12")).toHaveLength(0);
    expect(getActiveGoalsForDate(goals, "2026-10-20")).toHaveLength(0);
  });

  it("ignores future history entries", () => {
    const goals = [goal({ isActive: false, activeHistory: { "2026-12-01": true } })];
    expect(getActiveGoalsForDate(goals, "2026-10-14")).toHaveLength(0);
  });

  it("excludes goals created after the queried date", () => {
    const createdAt = new Date(2026, 9, 20).getTime();
    const goals = [goal({ createdAt })];
    expect(getActiveGoalsForDate(goals, "2026-10-14")).toHaveLength(0);
    expect(getActiveGoalsForDate(goals, "2026-10-20")).toHaveLength(1);
  });
});

describe("calculateGoalsStreak", () => {
  const goals = [goal({})];

  it("returns zeros and an all-white week with no logs", () => {
    const r = calculateGoalsStreak(goals, {});
    expect(r).toMatchObject({ currentStreak: 0, highestStreak: 0, currentPartials: 0 });
    expect(r.weekActivity).toHaveLength(7);
    expect(r.weekActivity.map((d) => d.emoji)).toEqual(Array(7).fill("⚪"));
  });

  it("counts consecutive fully-completed days", () => {
    const logs = { [dStr(2)]: doneLog("walk"), [dStr(1)]: doneLog("walk") };
    const r = calculateGoalsStreak(goals, logs);
    // today has no log yet → ⚪, streak covers the two completed days
    expect(r.currentStreak).toBe(2);
    expect(r.highestStreak).toBe(2);
  });

  it("resets the streak on a missed past day", () => {
    const logs = {
      [dStr(3)]: doneLog("walk"),
      // dStr(2) missed → ❌ break
      [dStr(1)]: doneLog("walk"),
    };
    const r = calculateGoalsStreak(goals, logs);
    expect(r.currentStreak).toBe(1);
    expect(r.highestStreak).toBe(1);
    expect(r.weekActivity.find((d) => d.dStr === dStr(2))?.emoji).toBe("❌");
  });

  it("treats partially completed days as 🙌 and breaks after 4 in a row", () => {
    const two = [goal({}), goal({ id: "run", isActive: true })];
    const partial = { walk: { completed: true }, run: { completed: false } };
    const logs = {
      [dStr(4)]: partial,
      [dStr(3)]: partial,
      [dStr(2)]: partial,
      [dStr(1)]: partial,
    };
    const r = calculateGoalsStreak(two, logs);
    expect(r.currentPartials).toBe(0);
    expect(r.currentStreak).toBe(0);
    expect(r.weekActivity.find((d) => d.dStr === dStr(1))?.isBreak).toBe(true);
  });

  it("ignores logs for goals that are not active that day", () => {
    const logs = { [dStr(1)]: { ghost: { completed: true } } };
    const r = calculateGoalsStreak(goals, logs);
    expect(r.weekActivity.find((d) => d.dStr === dStr(1))?.emoji).toBe("❌");
  });
});

describe("getWeeklyActivity", () => {
  it("returns the 7-day activity window", () => {
    const week = getWeeklyActivity([goal({})], { [dStr(0)]: doneLog("walk") });
    expect(week).toHaveLength(7);
    expect(week.at(-1)).toMatchObject({ isToday: true, emoji: "🔥" });
  });
});
