import { AppState, FamilySummary } from '../types';
import { calculateGoalsStreak } from './goalUtils';
import { getCoreBiomarkersByCategory, TIER_1, calculateStatus, isCoreBiomarkerPresent, hydrateBiomarker } from './biomarkerUtils';
import { getAggregateScore, getHydratedBiomarkers, sortLabReports, getCanvasHealthScore } from './derivedMetrics';
import getCareReminders from '../careReminderRules';

export function buildFamilySummary(state: AppState): Partial<FamilySummary> {
  // 1. Calculate health score
  let score = null;
  let prevScore = null;
  
  
  if (state.labReports && state.labReports.length > 0) {
    const { score: s, prevScore: ps } = getCanvasHealthScore(state.labReports);
    score = s;
    prevScore = ps;
  }


  // 2. BMI
  let bmi = 0;
  let currentWeight = 0;
  if (state.weightEntries && state.weightEntries.length > 0) {
    const sortedWeight = [...state.weightEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latest = sortedWeight[sortedWeight.length - 1];
    currentWeight = latest.weight;
    if (state.profile?.heightCm) {
      const hM = state.profile.heightCm / 100;
      bmi = Number((currentWeight / (hM * hM)).toFixed(1));
    }
  }

  // 3. Streak
  const streakInfo = calculateGoalsStreak(state.goals, state.goalLogs);
  const currentStreak = streakInfo.currentStreak || 0;
  const highestStreak = streakInfo.highestStreak || 0;
  const recentStreak = streakInfo.weekActivity?.map((a: any) => {
    if (a.emoji === '🔥') return 'completed';
    if (a.emoji === '🙌') return 'partial';
    if (a.emoji === '⚪') return 'none';
    return 'missed';
  }) || [];

  // 4. Glucose
  const glucoseEnabled = (state.profile as any)?.glucoseEnabled || (state.glucoseReadings && state.glucoseReadings.length > 0) || false;
  let latestGlucose: number | undefined = undefined;
  let latestGlucoseType: string | undefined = undefined;
  let hba1c: number | undefined = undefined;

  if (state.glucoseReadings && state.glucoseReadings.length > 0) {
    const sortedGlucose = [...state.glucoseReadings].sort((a, b) => {
      const timeA = new Date(`${a.date}T${a.time || '00:00'}:00`).getTime();
      const timeB = new Date(`${b.date}T${b.time || '00:00'}:00`).getTime();
      return timeA - timeB;
    });
    const latest = sortedGlucose[sortedGlucose.length - 1];
    latestGlucose = latest.value;
    latestGlucoseType = latest.timing;
  }

  if (state.labReports) {
    const hba1cReadings = [...state.labReports]
      .filter(r => r.biomarkers.some((b: any) => b.biomarkerId === 'hba1c'))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
    if (hba1cReadings.length > 0) {
      const latestReport = hba1cReadings[hba1cReadings.length - 1];
      const hba1cBiomarker = latestReport.biomarkers.find((b: any) => b.biomarkerId === 'hba1c');
      if (hba1cBiomarker) {
        hba1c = Number(hba1cBiomarker.value);
      }
    }
  }
  
  // 5. Highlights and Care Reminders
  // Note: we can generate highlights from biomarkers, but the instructions say "reuse existing helper functions wherever possible".
  // Highlights in Dashboard are generated in the AI section or hardcoded for mock?
  // Let's use the insights or we can leave highlights empty if not generated yet.
  
  const careReminders = getCareReminders({
    healthScore: score || null,
    glucoseTrackingEnabled: glucoseEnabled,
    glucoseReadings: state.glucoseReadings ? state.glucoseReadings.map(r => ({ timestamp: `${r.date}T${r.time || '00:00'}:00`, timing: r.timing as any })) : [],
    weightLogs: state.weightEntries ? state.weightEntries.map(w => ({ timestamp: `${w.date}T12:00:00` })) : [],
    healthReports: state.labReports ? state.labReports.map(r => ({ uploadedAt: `${r.date}T12:00:00` })) : []
  });

  return {
    healthScore: score || 0,
    prevHealthScore: prevScore || 0,
    bmi,
    currentWeight,
    highestStreak,
    currentStreak,
    recentStreak,
    glucoseEnabled,
    latestGlucose,
    glucoseUnit: 'mg/dL', // default
    latestGlucoseType,
    hba1c,
    careReminders,
    updatedAt: Date.now()
  };
}

export function getAdjustedMemberStreak(member: Partial<FamilySummary>): { recentStreak: string[], currentStreak: number } {
  let base = member.recentStreak && member.recentStreak.length === 7 
    ? [...member.recentStreak] 
    : ['none', 'none', 'none', 'none', 'none', 'none', 'none'];
    
  let currentStreak = member.currentStreak || 0;
    
  const updatedAt = member.updatedAt;
  if (updatedAt) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const updatedDate = new Date(updatedAt);
    updatedDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((today.getTime() - updatedDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays > 0 && diffDays < 7) {
      base = base.slice(diffDays);
      for (let i = 0; i < diffDays; i++) {
        base.push('missed');
      }
      currentStreak = 0;
    } else if (diffDays >= 7) {
      base = ['missed', 'missed', 'missed', 'missed', 'missed', 'missed', 'missed'];
      currentStreak = 0;
    }
  }
  
  return { recentStreak: base, currentStreak };
}
