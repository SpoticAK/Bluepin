export interface UserConsent {
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: number;
  userAgent: string;
  acceptedFromCountry?: string;
}

export type MealTiming = "Fasting" | "Post-Prandial" | "Random";

export interface GlucoseReading {
  id: string;
  value: number;
  unit: string;
  timing: MealTiming;
  hoursAfterEating?: number;
  source?: 'Manual' | 'OCR';
  imageUrl?: string;
  date: string;
  time: string;
  createdAt: number;
}

export type BiomarkerCategory = string;

export interface Biomarker {
  name: string; // Cannonical name, or raw name if no match
  originalName?: string; // The raw name extracted by OCR
  biomarkerId?: string | null; // Canonical ID from registry
  confidence?: 'High' | 'Medium' | 'Low' | 'None';
  matchedBy?: string;
  category: BiomarkerCategory;
  specimenType?: string;
  reportType?: string;
  value: number;
  unit: string;
  refMin?: number;
  refMax?: number;
  refRangeText?: string;
  status: 'Healthy' | 'Borderline' | 'Needs Attention';
  info?: string;
}

export interface LabReport {
  id: string;
  name?: string;
  fileUrl?: string;
  date: string;
  reportType?: string;
  specimenType?: string;
  biomarkers: Biomarker[];
  createdAt: number;
}

export interface WeightEntry {
  id: string;
  weight: number; // in kg
  date: string;
  createdAt: number;
}

export interface Goal {
  id: string;
  title: string;
  category: string;
  frequency: "daily" | "weekly" | "custom";
  targetType: "checkbox" | "number";
  targetValue?: number;
  unit?: string;
  isActive: boolean;
  createdAt?: any;
  activeHistory?: Record<string, boolean>;
}

// Stores completed goals by date (YYYY-MM-DD)
export interface GoalLog {
  [date: string]: {
    [goalId: string]: {
      completed: boolean;
      value?: number;
      updatedAt?: any;
    }
  }
}

export interface UserProfile {
  consent?: UserConsent;
  name?: string;
  age?: number;
  gender?: string;
  heightCm: number;
  weight?: number;
  glucoseEnabled?: boolean;
  bmi?: number;
  country?: string;
  photoUrl?: string;
  profileColor?: string;
  familyId?: string | null;
}

export interface FamilyMemberMeta {
  role: 'admin' | 'member';
  joinedAt: number;
}

export interface Family {
  id: string;
  name: string;
  createdAt: number;
  members: Record<string, FamilyMemberMeta>;
}

export interface FamilySummary {
  userId: string;
  name: string;
  avatarColor?: string;
  photoUrl?: string;
  healthScore: number;
  prevHealthScore?: number;
  bmi: number;
  currentStreak: number;
  highestStreak?: number;
  recentStreak?: ('completed' | 'partial' | 'missed' | 'none')[];
  glucoseEnabled: boolean;
  latestGlucose?: number;
  glucoseUnit?: string;
  latestGlucoseType?: string;
  hba1c?: number;
  currentWeight?: number;
  healthHighlights?: string[];
  quickObservations?: string[];
  careReminders?: any[];
  updatedAt: number;
}

export interface Invitation {
  id: string;
  familyId: string;
  familyName: string;
  inviterId: string;
  inviterName: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: number;
  expiresAt: number;
}

export interface AppState {
  glucoseReadings: GlucoseReading[];
  labReports: LabReport[];
  weightEntries: WeightEntry[];
  goals: Goal[];
  goalLogs: GoalLog;
  profile: UserProfile;
  family: Family | null;
  familySummaries: Record<string, FamilySummary>;
  deletedDummyGlucoseIds?: string[];
}
