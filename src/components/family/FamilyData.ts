import { GoalLog, Biomarker } from '../../types';
import { format, subDays } from 'date-fns';



export interface FamilyMember {
  id: string;
  name: string;
  avatarColor?: string;
  photoUrl?: string;
  healthScore: number;
  prevHealthScore?: number;
  bmi: number;
  currentStreak: number;
  highestStreak?: number;
  recentStreak?: ('completed' | 'partial' | 'missed' | 'none')[];
  primaryAttention?: string; // Highest-priority biomarker name + value
  glucoseEnabled: boolean;
  latestGlucose?: number;
  glucoseUnit?: string;
  latestGlucoseType?: 'Fasting' | 'Random' | 'Post-prandial' | 'HbA1c';
  
  // For Profile
  borderlineBiomarkers: { name: string; value: number; unit: string }[];
  needsAttentionBiomarkers: { name: string; value: number; unit: string }[];
  quickObservations: string[];
  healthHighlights?: string[];
  careReminders?: any[];
  latestReportDate: string;
  biomarkers: Biomarker[]; // all biomarkers for Health Summary classification
  
  labReports: { id: string; name: string; date: string; fileUrl?: string; score?: number, biomarkers?: Biomarker[] }[];
  
  glucoseHistory: { date: string; value: number; type?: 'Fasting' | 'Random' | 'Post-prandial' | 'HbA1c' }[];
  hba1c: number;
  
  weightHistory: { date: string; weight: number; bmi: number }[];
  currentWeight: number;
  
  activeGoals?: { id: string; name: string; completed: boolean }[];
  goals?: any[];
  goalLogs?: any;
}

