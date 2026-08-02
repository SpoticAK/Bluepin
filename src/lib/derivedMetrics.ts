import { getCoreBiomarkersByCategory, TIER_1, calculateStatus, isCoreBiomarkerPresent, hydrateBiomarker } from './biomarkerUtils';
import { Biomarker, LabReport, Goal, GoalLog, GlucoseReading } from '../types';
import { parseISO, subDays } from 'date-fns';

export function sortLabReports(reports: LabReport[]) {
  if (!reports) return [];
  return [...reports].sort((a, b) => {
    try {
      const dateA = typeof a.date === 'string' ? parseISO(a.date).getTime() : new Date(a.date).getTime();
      const dateB = typeof b.date === 'string' ? parseISO(b.date).getTime() : new Date(b.date).getTime();
      const diff = dateA - dateB;
      if (diff !== 0 && !isNaN(diff)) return diff;
    } catch (e) {}
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

export function getHydratedBiomarkers(reports: LabReport[]) {
  if (!reports || reports.length === 0) return [];
  const sortedReports = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const latestBiomarkers = new Map<string, any>();
  sortedReports.forEach(report => {
    if (report.biomarkers) {
      report.biomarkers.forEach(bRaw => {
        const b = hydrateBiomarker(bRaw);
        const key = b.biomarkerId || b.name;
        latestBiomarkers.set(key, { ...b, reportDate: report.date });
      });
    }
  });

  return Array.from(latestBiomarkers.values()).map(b => ({
    ...b,
    ...calculateStatus(b.biomarkerId || b.name, b.value, b.refMin, b.refMax, b.status, b.refRangeText)
  }));
}

export function getMissingBiomarkersMetrics(hydratedBiomarkers: any[]) {
  const availableNames = hydratedBiomarkers.map(b => b.name);
  let missingCoreCount = 0;
  const missingCoreCategorized: Record<string, string[]> = {};
  const missedBiomarkers: string[] = [];
  const missedBiomarkersCategorized: Record<string, string[]> = {};

  Object.entries(getCoreBiomarkersByCategory()).forEach(([category, markers]) => {
    const missing = markers.filter(m => !isCoreBiomarkerPresent(m, availableNames));
    if (missing.length > 0) {
      missingCoreCount += missing.length;
      missingCoreCategorized[category] = missing;
      missedBiomarkers.push(...missing);
      missedBiomarkersCategorized[category] = missing;
    }
  });

  return {
    missingCoreCount,
    missingCoreCategorized,
    missedBiomarkers,
    missedBiomarkersCategorized,
    isComplete: missingCoreCount === 0
  };
}

export function getReportScore(report: LabReport) {
  if (!report || !report.biomarkers || report.biomarkers.length === 0) return null;
  let tot = 0, earn = 0;
  report.biomarkers.forEach(bRaw => {
     const b = hydrateBiomarker(bRaw);
     const stObj = calculateStatus(b.biomarkerId || b.name, b.value, b.refMin, b.refMax, b.status, b.refRangeText);
     const isTier1 = b.biomarkerId ? TIER_1.includes(b.biomarkerId) : false;
     const weight = isTier1 ? 2 : 1;
     tot += weight;
     if (stObj.status === 'Healthy') earn += weight;
     else if (stObj.status === 'Borderline') earn += weight * 0.5;
  });
  return tot > 0 ? Math.round((earn / tot) * 100) : null;
}

export function getAggregateScore(biomarkersList: any[]) {
  if (!biomarkersList || biomarkersList.length === 0) return null;
  let tot = 0, earn = 0;
  biomarkersList.forEach(b => {
     const stObj = calculateStatus(b.biomarkerId || b.name, b.value, b.refMin, b.refMax, b.status, b.refRangeText);
     const isTier1 = b.biomarkerId ? TIER_1.includes(b.biomarkerId) : false;
     const weight = isTier1 ? 2 : 1;
     tot += weight;
     if (stObj.status === 'Healthy') earn += weight;
     else if (stObj.status === 'Borderline') earn += weight * 0.5;
  });
  return tot > 0 ? Math.round((earn / tot) * 100) : null;
}

export function getBiomarkerCounts(hydratedBiomarkers: any[]) {
  return {
    healthyCount: hydratedBiomarkers.filter(b => b.status === 'Healthy').length,
    borderlineCount: hydratedBiomarkers.filter(b => b.status === 'Borderline').length,
    needsAttentionCount: hydratedBiomarkers.filter(b => b.status === 'Needs Attention').length,
  };
}

export function getDashboardMetrics(reports: LabReport[], hydratedBiomarkers: any[]) {
  let score = null;
  let prevScore = null;
  if (hydratedBiomarkers && hydratedBiomarkers.length > 0) {
    score = getAggregateScore(hydratedBiomarkers);
    if (reports && reports.length > 1) {
       const sortedReports = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
       const prevBiomarkers = getHydratedBiomarkers(sortedReports.slice(0, -1));
       prevScore = getAggregateScore(prevBiomarkers);
    } else {
       prevScore = score;
    }
  }

  const missingMetrics = getMissingBiomarkersMetrics(hydratedBiomarkers);
  const counts = getBiomarkerCounts(hydratedBiomarkers);

  return {
    score,
    prevScore,
    needsAttention: counts.needsAttentionCount,
    missingCoreCount: missingMetrics.missingCoreCount,
    highLowCount: counts.needsAttentionCount,
    borderlineCount: counts.borderlineCount,
    optimalCount: counts.healthyCount,
    isComplete: missingMetrics.isComplete,
    missingCoreCategorized: missingMetrics.missingCoreCategorized
  };
}

export function getSugarInsights(history: any[]) {
  if (!history) return null;
  const filterKey = 'timing';
  const ppKey = 'Post-Prandial';

  const validHistory = history.filter(h => h[filterKey] !== 'HbA1c');
  
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);
  const sixtyDaysAgo = subDays(now, 60);
  
  const recentLogs = validHistory.filter(h => {
    try { return new Date(h.date) >= thirtyDaysAgo; } catch(e) { return false; }
  });
  const previousLogs = validHistory.filter(h => {
    try { const d = new Date(h.date); return d >= sixtyDaysAgo && d < thirtyDaysAgo; } catch(e) { return false; }
  });
  
  const getStats = (logs: any[], type: string) => {
    const filtered = logs.filter(h => h[filterKey] === type);
    if (filtered.length === 0) return { avg: null, count: 0, items: [] };
    const avg = filtered.reduce((acc, cur) => acc + cur.value, 0) / filtered.length;
    return { avg: Math.round(avg), count: filtered.length, items: filtered };
  };

  const recentFasting = getStats(recentLogs, 'Fasting');
  const prevFasting = getStats(previousLogs, 'Fasting');
  
  const recentPP = getStats(recentLogs, ppKey);
  const prevPP = getStats(previousLogs, ppKey);
  
  const recentRandom = getStats(recentLogs, 'Random');
  const prevRandom = getStats(previousLogs, 'Random');

  const cards = {
    fasting: {
      avg: recentFasting.avg,
      diff: recentFasting.avg && prevFasting.avg ? recentFasting.avg - prevFasting.avg : null,
      pct: recentFasting.avg && prevFasting.avg ? Math.round(((recentFasting.avg - prevFasting.avg) / prevFasting.avg) * 100) : null
    },
    pp: {
      avg: recentPP.avg,
      diff: recentPP.avg && prevPP.avg ? recentPP.avg - prevPP.avg : null,
      pct: recentPP.avg && prevPP.avg ? Math.round(((recentPP.avg - prevPP.avg) / prevPP.avg) * 100) : null
    },
    random: {
      avg: recentRandom.avg,
      diff: recentRandom.avg && prevRandom.avg ? recentRandom.avg - prevRandom.avg : null,
      pct: recentRandom.avg && prevRandom.avg ? Math.round(((recentRandom.avg - prevRandom.avg) / prevRandom.avg) * 100) : null
    }
  };

  const better = [];
  const attention = [];
  const recommendations = [];

  const fastingLimit = 99;
  const otherLimit = 140;

  const allRecentValues = recentLogs.map(h => h.value);
  const allPreviousValues = previousLogs.map(h => h.value);
  const recentVariability = allRecentValues.length > 1 ? Math.max(...allRecentValues) - Math.min(...allRecentValues) : 0;
  const previousVariability = allPreviousValues.length > 1 ? Math.max(...allPreviousValues) - Math.min(...allPreviousValues) : 0;

  const hypoLogs = recentLogs.filter(h => h.value < 70);
  const hyperLogs = recentLogs.filter(h => h.value > 250);

  if (recentFasting.avg && prevFasting.avg) {
    if (recentFasting.avg < prevFasting.avg - 2) {
      const diff = prevFasting.avg - recentFasting.avg;
      const pct = Math.abs(cards.fasting.pct || 0);
      better.push(`Average fasting glucose improved by ${diff} mg/dL (${pct}%) compared to last month.`);
    } else if (recentFasting.avg > prevFasting.avg + 2) {
      const diff = recentFasting.avg - prevFasting.avg;
      attention.push(`Average fasting glucose increased by ${diff} mg/dL since last month.`);
    }
  }

  if (recentPP.avg && prevPP.avg) {
    if (recentPP.avg < prevPP.avg - 2) {
      const diff = prevPP.avg - recentPP.avg;
      const pct = Math.abs(cards.pp.pct || 0);
      better.push(`Average post-meal glucose improved by ${diff} mg/dL (${pct}%).`);
    } else if (recentPP.avg > prevPP.avg + 2) {
      const diff = recentPP.avg - prevPP.avg;
      attention.push(`Average post-meal glucose increased by ${diff} mg/dL.`);
    }
  }

  if (recentRandom.avg && prevRandom.avg) {
    if (recentRandom.avg < prevRandom.avg - 2) {
      const diff = prevRandom.avg - recentRandom.avg;
      const pct = Math.abs(cards.random.pct || 0);
      better.push(`Average random glucose improved by ${diff} mg/dL (${pct}%).`);
    } else if (recentRandom.avg > prevRandom.avg + 2) {
      const diff = recentRandom.avg - prevRandom.avg;
      attention.push(`Average random glucose increased by ${diff} mg/dL.`);
    }
  }

  if (recentVariability > 0 && previousVariability > 0) {
    if (recentVariability < previousVariability - 10) {
      better.push("Glucose levels are more stable this month with fewer spikes.");
    } else if (recentVariability > previousVariability + 15) {
      attention.push("Higher glucose variability detected this month. Try to maintain consistent meal times.");
    }
  }

  if (hypoLogs.length > 0) {
    attention.push(`${hypoLogs.length} low blood sugar event(s) detected (<70 mg/dL).`);
  }
  if (hyperLogs.length > 0) {
    attention.push(`${hyperLogs.length} severe high blood sugar event(s) detected (>250 mg/dL).`);
  }

  if (better.length === 0 && attention.length === 0) {
    if (recentLogs.length > 5) {
      better.push("Blood sugar trends are stable compared to last month.");
    } else {
      recommendations.push("Log more readings consistently for 30 days to see detailed trend insights.");
    }
  }

  if (recentFasting.avg && recentFasting.avg > fastingLimit) {
    recommendations.push("Fasting levels are elevated. Consider a short walk after dinner or checking evening snacks.");
  }
  if (recentPP.avg && recentPP.avg > otherLimit) {
    recommendations.push("Post-meal spikes detected. Try balancing meals with more fiber or protein, and moving for 10-15 minutes after eating.");
  }
  if (hypoLogs.length > 0) {
    recommendations.push("Review medication timing or missed meals, as you've experienced low blood sugar.");
  }
  
  if (recentLogs.length > 0 && recommendations.length === 0) {
    recommendations.push("Great job! Keep up your current routine of balanced diet and regular activity.");
  }

  return { cards, better, attention, recommendations };
}


export function getMissedBiomarkers(reports: LabReport[]) {
  if (!reports || reports.length < 2) {
    return { missedBiomarkers: [], missedBiomarkersCategorized: {} as Record<string, string[]> };
  }

  const sortedReports = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latestReport = sortedReports[sortedReports.length - 1];
  const latestBiomarkerNames = latestReport.biomarkers ? (latestReport.biomarkers || []).map(b => b.biomarkerId || b.name) : [];
  
  const missedMap = new Map<string, any>();
  
  for (let i = 0; i < sortedReports.length - 1; i++) {
    const report = sortedReports[i];
    if (report.biomarkers) {
      report.biomarkers.forEach(bRaw => {
        const b = hydrateBiomarker(bRaw);
        if (b.status === "Needs Attention" || b.status === "Borderline") {
          const isPresentInLatest = latestBiomarkerNames.some(latestName => 
            (b.biomarkerId && b.biomarkerId === latestName) || (!b.biomarkerId && b.name === latestName)
          );
          if (!isPresentInLatest) {
            missedMap.set(b.name.toLowerCase().trim(), b);
          }
        }
      });
    }
  }
  
  const missedArray = Array.from(missedMap.values());
  const categorized: Record<string, string[]> = {};
  missedArray.forEach(b => {
    if (!categorized[b.category]) categorized[b.category] = [];
    categorized[b.category].push(b.name);
  });
  
  return { missedBiomarkers: missedArray, missedBiomarkersCategorized: categorized };
}

export function getCanvasHealthScore(reports: LabReport[]) {
  if (!reports || reports.length === 0) return { score: null, prevScore: null, needsAttention: 0, borderline: 0, highLowCount: 0, borderlineCount: 0 };
  
  const sorted = sortLabReports(reports);
  const latestReport = sorted[sorted.length - 1];
  
  const latestBiomarkers = (latestReport.biomarkers || []).map((bRaw: any) => {
    const b = hydrateBiomarker(bRaw);
    return {
      ...b,
      ...calculateStatus(b.biomarkerId || b.name, b.value, b.refMin, b.refMax, b.status, b.refRangeText)
    };
  });
  
  const score = getAggregateScore(latestBiomarkers);
  
  let prevScore = score;
  if (sorted.length > 1) {
    const prevReport = sorted[sorted.length - 2];
    const prevBiomarkers = (prevReport.biomarkers || []).map((bRaw: any) => {
      const b = hydrateBiomarker(bRaw);
      return {
        ...b,
        ...calculateStatus(b.biomarkerId || b.name, b.value, b.refMin, b.refMax, b.status, b.refRangeText)
      };
    });
    prevScore = getAggregateScore(prevBiomarkers);
  }
  
  const needsAttention = latestBiomarkers.filter((b:any) => b.status === "Needs Attention" || b.status === "Borderline").length;
  const highLowCount = latestBiomarkers.filter((b:any) => b.status === "Needs Attention").length;
  const borderlineCount = latestBiomarkers.filter((b:any) => b.status === "Borderline").length;
  
  return {
    score,
    prevScore,
    needsAttention,
    highLowCount,
    borderlineCount,
    latestBiomarkers
  };
}

export function getReportHealthScore(report: LabReport) {
  if (!report || !report.biomarkers || report.biomarkers.length === 0) return { score: null, needsAttention: 0, borderline: 0 };
  
  const hydrated = report.biomarkers.map((bRaw: any) => {
    const b = hydrateBiomarker(bRaw);
    return {
      ...b,
      ...calculateStatus(b.biomarkerId || b.name, b.value, b.refMin, b.refMax, b.status, b.refRangeText)
    };
  });
  
  const score = getAggregateScore(hydrated);
  const needsAttention = hydrated.filter((b:any) => b.status === "Needs Attention" || b.status === "Borderline").length;
  const borderlineCount = hydrated.filter((b:any) => b.status === "Borderline").length;
  
  return {
    score,
    needsAttention,
    borderline: borderlineCount
  };
}
