import { Goal, GlucoseReading } from "./types";

export const DUMMY_GLUCOSE_READINGS: GlucoseReading[] = [];

export const DEFAULT_GOALS: Goal[] = [
  // Activity
  { id: "g1", title: "Walk 5,000+ steps", category: "Activity", frequency: "daily", targetType: "checkbox", isActive: true },
  { id: "g2", title: "Walk 10,000+ steps", category: "Activity", frequency: "daily", targetType: "checkbox", isActive: false },
  { id: "g3", title: "Exercise for 30 minutes", category: "Activity", frequency: "daily", targetType: "checkbox", isActive: true },
  { id: "g4", title: "Play a sport / Yoga", category: "Activity", frequency: "daily", targetType: "checkbox", isActive: false },

  // Nutrition
  { id: "g5", title: "Eat only home-cooked meals", category: "Nutrition", frequency: "daily", targetType: "checkbox", isActive: false },
  { id: "g6", title: "Avoid sugary drinks today", category: "Nutrition", frequency: "daily", targetType: "checkbox", isActive: true },
  { id: "g7", title: "Avoid deep-fried food today", category: "Nutrition", frequency: "daily", targetType: "checkbox", isActive: false },
  { id: "g8", title: "Meet daily protein goal", category: "Nutrition", frequency: "daily", targetType: "checkbox", isActive: false },

  // Recovery
  { id: "g9", title: "Meditate for 20 minutes", category: "Recovery", frequency: "daily", targetType: "checkbox", isActive: false },
  { id: "g10", title: "Sleep before 11:00 PM", category: "Recovery", frequency: "daily", targetType: "checkbox", isActive: false },
  { id: "g11", title: "Sleep at least 7 hours", category: "Recovery", frequency: "daily", targetType: "checkbox", isActive: true },

  // Medication
  { id: "g12", title: "Take all prescribed medications", category: "Medication", frequency: "daily", targetType: "checkbox", isActive: false },
  { id: "g13", title: "Check and log today\'s health reading", category: "Medication", frequency: "daily", targetType: "checkbox", isActive: false },
];
