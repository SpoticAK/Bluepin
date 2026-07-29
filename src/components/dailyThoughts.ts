/**
 * Dashboard Quotes
 * ----------------
 * A curated collection of warm, optimistic, thoughtful quotes
 * displayed beneath the greeting on the dashboard.
 *
 * Design principles:
 * - Warm and human
 * - Philosophical without being melancholic
 * - Motivating without sounding preachy
 * - Encouraging without creating guilt
 * - Relevant to health, growth, care, and everyday life
 * - Short enough to work well in the dashboard UI
 */

export const DASHBOARD_QUOTES = [
  // Progress
  "A little progress still changes the direction.",
  "Small choices become the life you live.",
  "The direction matters more than the speed.",
  "Quiet progress is still progress.",
  "One better choice is enough to begin.",
  "Momentum often begins with something small.",
  "Every step forward becomes part of your story.",
  "You are closer than you were yesterday.",

  // Growth
  "The future is shaped quietly, one day at a time.",
  "Growth rarely announces itself while it is happening.",
  "Consistency is how intention becomes change.",
  "The life ahead is built from the days you have now.",
  "What you do often matters more than what you do perfectly.",
  "You are allowed to grow at your own pace.",
  "Keep showing up for the person you are becoming.",
  "There is always something worth moving toward.",

  // Health and self-care
  "Today is another chance to care for yourself.",
  "Your body remembers the care you give it.",
  "Health is built in moments that often feel ordinary.",
  "Every act of care counts, even the small ones.",
  "Knowing your health is the first step toward shaping it.",
  "You are building health, not chasing perfection.",
  "The best time to care for tomorrow is today.",
  "Make today a little kinder to your future self.",

  // Gentle motivation
  "A good day can begin with one good decision.",
  "Begin where you are. Build from there.",
  "You do not need a perfect day to make a good choice.",
  "Some days are for progress. Some are for persistence.",
  "You have more time to change than you think.",
  "Small beginnings can lead somewhere remarkable.",
  "The next step does not have to be a big one.",
  "Today still has something good to offer.",

  // Philosophical and hopeful
  "A meaningful life is built in ordinary moments.",
  "The smallest habits often leave the longest echoes.",
  "The person you become is shaped by what you return to.",
  "The future begins in ordinary moments like this one.",
  "There is strength in choosing to begin again.",
  "A life well lived is built one day at a time.",
  "Change often begins before we can see it.",
  "What you nurture today can grow beyond today.",

  // Warm encouragement
  "Be proud of the effort no one else can see.",
  "You have already begun. Keep going.",
  "There is no small act of caring for yourself.",
  "Give yourself something to thank yourself for tomorrow.",
  "You can always make the next choice a good one.",
  "Your pace is still a pace.",
  "Better does not have to mean perfect.",
  "Keep a little faith in what consistency can do.",

  // Perspective
  "You do not have to see the whole path to take the next step.",
  "A better tomorrow is often built quietly today.",
  "The days that feel ordinary are still shaping your life.",
  "What feels small today may matter greatly over time.",
  "There is more possibility in today than it first appears.",
  "The way forward is made by moving forward.",
  "Every day gives you something new to build with.",
  "The future is not found. It is made.",

  // Resilience
  "Starting again is still moving forward.",
  "A difficult day does not undo your progress.",
  "Progress can pause without disappearing.",
  "You can begin again as many times as you need.",
  "One imperfect day is only one day.",
  "The next chapter does not have to resemble the last.",
  "There is courage in continuing.",
  "You are still becoming.",

  // Everyday optimism
  "Something good can begin today.",
  "There is always room for one good choice.",
  "Let today surprise you.",
  "Make room for the possibility of a good day.",
  "The ordinary can become meaningful when you care for it.",
  "Today is yours to shape.",
  "A little hope can carry a long way.",
  "Good things are often built slowly.",

  // Future self
  "Your future self is being shaped by today.",
  "Do something today that tomorrow will remember kindly.",
  "The person you are becoming begins with the choices you make now.",
  "Care for the future by caring for the present.",
  "Tomorrow begins long before midnight.",
  "Build a future you will be glad to arrive in.",
  "Every good habit is a gift sent forward in time.",
  "The future grows from what you choose to nurture today.",
] as const;

/**
 * Type representing any valid dashboard quote.
 */
export type DashboardQuote = (typeof DASHBOARD_QUOTES)[number];

/**
 * Returns the day number within the current year.
 *
 * January 1 = 1
 * December 31 = 365 or 366
 */
function getDayOfYear(date: Date): number {
  const startOfYear = new Date(
    date.getFullYear(),
    0,
    0
  );

  const difference =
    date.getTime() - startOfYear.getTime();

  const millisecondsPerDay =
    1000 * 60 * 60 * 24;

  return Math.floor(
    difference / millisecondsPerDay
  );
}

/**
 * Returns a stable quote for the current calendar day.
 *
 * The quote:
 * - Changes once per day
 * - Does not change when the page is refreshed
 * - Does not change when the component re-renders
 * - Automatically cycles through the available quote collection
 */
export function getDailyDashboardQuote(
  date: Date = new Date()
): DashboardQuote {
  const dayOfYear = getDayOfYear(date);

  const index =
    dayOfYear % DASHBOARD_QUOTES.length;

  return DASHBOARD_QUOTES[index];
}

/**
 * Returns a random dashboard quote.
 *
 * Use this only when a genuinely random quote is desired.
 * For the main dashboard, getDailyDashboardQuote() is preferred
 * because it provides a consistent quote throughout the day.
 */
export function getRandomDashboardQuote(): DashboardQuote {
  const randomIndex = Math.floor(
    Math.random() * DASHBOARD_QUOTES.length
  );

  return DASHBOARD_QUOTES[randomIndex];
}

/**
 * Returns a quote based on a supplied numeric seed.
 *
 * Useful when you want a stable quote tied to a user,
 * family member, health event, or another deterministic value.
 */
export function getDashboardQuoteBySeed(
  seed: number
): DashboardQuote {
  const normalizedSeed = Math.abs(
    Math.floor(seed)
  );

  const index =
    normalizedSeed % DASHBOARD_QUOTES.length;

  return DASHBOARD_QUOTES[index];
}

/**
 * Default export for compatibility with components
 * that import the quotes collection directly.
 */
export default DASHBOARD_QUOTES;
