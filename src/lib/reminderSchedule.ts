/**
 * Shared reminder scheduling helpers.
 * Used by both the browser client (to initialise nextRunAt) and the server
 * scheduler (to advance nextRunAt after a notification fires).
 * Deliberately dependency-free and pure so it runs under Vite and Node.
 */

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** 1 (Monday) .. 7 (Sunday), matching JS getDay() with 0 mapped to 7. */
export function weekdayOf(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

export function getTimezoneOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  const hour = Number(parts.hour || 0) % 24;
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

function wallTimeToUtc(
  timeZone: string,
  y: number,
  m: number, // 1-based
  d: number,
  hh: number,
  mm: number,
): number {
  // Solve for the UTC instant at which the wall-clock time in `timeZone`
  // equals (y, m, d, hh, mm). Iterating a couple of times converges for
  // both normal and (most) DST boundary cases.
  let guess = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 3; i++) {
    const offset = getTimezoneOffsetMinutes(timeZone, new Date(guess));
    const corrected = Date.UTC(y, m - 1, d, hh, mm) - offset * 60000;
    if (corrected === guess) break;
    guess = corrected;
  }
  return guess;
}

/**
 * Returns the next occurrence (epoch ms) strictly after `from` for the given
 * daily schedule, or null when the schedule is empty/invalid.
 *
 * @param times 24h clock strings like "08:00"
 * @param days  weekday numbers 1 (Mon) .. 7 (Sun); empty array means every day
 * @param timeZone IANA timezone id, e.g. "Asia/Kolkata"
 * @param from  epoch ms to search from
 */
export function getNextRunTimestamp(
  times: string[],
  days: number[],
  timeZone: string,
  from: number,
): number | null {
  const valid = times
    .filter((t) => typeof t === "string" && /^\d{1,2}:\d{2}$/.test(t))
    .sort();
  if (!valid.length) return null;
  const daySet = days.filter((d) => d >= 1 && d <= 7);

  const fromDate = new Date(from);
  for (let i = 0; i < 15; i++) {
    const base = new Date(
      fromDate.getFullYear(),
      fromDate.getMonth(),
      fromDate.getDate() + i,
    );
    const todayOnly = i === 0;
    if (daySet.length && !daySet.includes(weekdayOf(base))) continue;

    const candidates: number[] = [];
    for (const t of valid) {
      const [hh, mm] = t.split(":").map(Number);
      const ts = wallTimeToUtc(
        timeZone,
        base.getFullYear(),
        base.getMonth() + 1,
        base.getDate(),
        hh,
        mm,
      );
      candidates.push(ts);
    }
    if (todayOnly) {
      const future = candidates.filter((ts) => ts > from);
      if (future.length) return Math.min(...future);
    } else {
      return Math.min(...candidates);
    }
  }
  return null;
}

/** Formats a next-run epoch ms with the browser's default locale. */
export function formatReminderTime(ms: number | null | undefined): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today at ${t}`;
  const timeOnly = d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${d.toLocaleDateString([], { weekday: "short" })} at ${timeOnly}`;
}