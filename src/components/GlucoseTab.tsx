import { auth } from '../lib/firebase';
import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from 'recharts';
import { subDays, subMonths, parseISO, isAfter, startOfDay, format } from 'date-fns';
import { Activity, CheckCircle2, UploadCloud, Camera, Plus, Loader2, Info, Edit, Trash2, Droplet, Check, AlertTriangle, AlertCircle, Hexagon, X, Asterisk, ChevronRight, Triangle } from 'lucide-react';
import { GlucoseReading, MealTiming } from '../types';
import { v4 as uuidv4 } from "uuid";
import { cn, safeFormat } from '../lib/utils';

export default function GlucoseTab() {
 const { glucoseReadings, addGlucoseReading, removeGlucoseReading, labReports } = useAppStore();
 const [showAddModal, setShowAddModal] = useState(false);
 const [timeFilter, setTimeFilter] = useState<number>(30); // days
 const [selectedType, setSelectedType] = useState<MealTiming | 'HbA1c'>('Fasting');
 const [showAllTimeline, setShowAllTimeline] = useState(false);
 const [showHba1cInfo, setShowHba1cInfo] = useState(false);
 const [showCriteriaModal, setShowCriteriaModal] = useState(false);
 const [hasCalculated, setHasCalculated] = useState(false);

 const [showSugarHealth, setShowSugarHealth] = useState(false);
 const sugarInsights = useMemo(() => {
 if (!glucoseReadings) return null;

 const history = glucoseReadings.filter(h => h.timing !== 'HbA1c');
 
 const now = new Date();
 const thirtyDaysAgo = subDays(now, 30);
 const sixtyDaysAgo = subDays(now, 60);
 
 const recentLogs = history.filter(h => {
 try { return new Date(h.date) >= thirtyDaysAgo; } catch(e) { return false; }
 });
 const previousLogs = history.filter(h => {
 try { const d = new Date(h.date); return d >= sixtyDaysAgo && d < thirtyDaysAgo; } catch(e) { return false; }
 });
 
 const getStats = (logs: typeof history, type: string) => {
 const filtered = logs.filter(h => h.timing === type);
 if (filtered.length === 0) return { avg: null, count: 0, items: [] };
 const avg = filtered.reduce((acc, cur) => acc + cur.value, 0) / filtered.length;
 return { avg: Math.round(avg), count: filtered.length, items: filtered };
 };

 const recentFasting = getStats(recentLogs, 'Fasting');
 const prevFasting = getStats(previousLogs, 'Fasting');
 
 const recentPP = getStats(recentLogs, 'Post-Prandial');
 const prevPP = getStats(previousLogs, 'Post-Prandial');
 
 const recentRandom = getStats(recentLogs, 'Random');
 const prevRandom = getStats(previousLogs, 'Random');

 const recentAvg = recentLogs.length > 0 ? recentLogs.reduce((acc, cur) => acc + cur.value, 0) / recentLogs.length : 0;
 const previousAvg = previousLogs.length > 0 ? previousLogs.reduce((acc, cur) => acc + cur.value, 0) / previousLogs.length : 0;

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

 const better: string[] = [];
 const attention: string[] = [];
 const recommendations: string[] = [];

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
 better.push(`Average post-prandial glucose improved by ${diff} mg/dL compared to last month.`);
 } else if (recentPP.avg > prevPP.avg + 2) {
 const diff = recentPP.avg - prevPP.avg;
 attention.push(`Average post-prandial glucose increased by ${diff} mg/dL since last month.`);
 }
 }

 if (recentRandom.avg && prevRandom.avg) {
 if (recentRandom.avg < prevRandom.avg - 2) {
 const diff = prevRandom.avg - recentRandom.avg;
 better.push(`Average random glucose improved by ${diff} mg/dL compared to last month.`);
 }
 }

 if (recentAvg && previousAvg && better.length === 0 && attention.length === 0) {
 if (recentAvg < previousAvg - 2) {
 const pct = Math.round(((previousAvg - recentAvg) / previousAvg) * 100);
 better.push(`Overall average glucose improved by ${pct}% compared to last month.`);
 }
 }

 if (recentFasting.avg) {
 if (recentFasting.avg > fastingLimit) {
 const pct = Math.round(((recentFasting.avg - fastingLimit) / fastingLimit) * 100);
 attention.push(`Average fasting glucose remains ${pct}% above target.`);
 } else if (recentFasting.avg <= fastingLimit) {
 better.push("Average fasting glucose is within target range.");
 }
 }

 const highFastingRecent = recentFasting.items?.filter(h => h.value > fastingLimit) || [];
 if (recentFasting.count >= 3 && highFastingRecent.length / recentFasting.count > 0.6) {
 attention.push("Persistent fasting hyperglycaemia detected.");
 }

 const highPPRecent = recentPP.items?.filter(h => h.value > otherLimit) || [];
 if (recentPP.count >= 3 && highPPRecent.length / recentPP.count > 0.5) {
 attention.push("Frequent post-meal spikes are present.");
 }

 if (recentVariability > 60 && recentVariability > previousVariability + 10) {
 attention.push("High glucose variability detected this month.");
 } else if (recentVariability > 0 && previousVariability > 0 && recentVariability < previousVariability - 15) {
 better.push("Glucose variability decreased compared to last month.");
 }

 if (recentLogs.length > 5 && hypoLogs.length === 0) {
 better.push("No hypoglycaemic episodes (<70 mg/dL) detected this month.");
 } else if (hypoLogs.length > 0) {
 attention.push(`${hypoLogs.length} hypoglycaemic episodes detected.`);
 }

 if (hyperLogs.length > 0) {
 attention.push(`${hyperLogs.length} severe hyperglycaemic episodes (>250 mg/dL) detected.`);
 }

 const weekendLogs = recentLogs.filter(h => {
 try { const day = new Date(h.date).getDay(); return day === 0 || day === 6; } catch { return false; }
 });
 const weekdayLogs = recentLogs.filter(h => {
 try { const day = new Date(h.date).getDay(); return day > 0 && day < 6; } catch { return false; }
 });
 const weekendAvg = weekendLogs.length ? weekendLogs.reduce((acc, cur) => acc + cur.value, 0) / weekendLogs.length : 0;
 const weekdayAvg = weekdayLogs.length ? weekdayLogs.reduce((acc, cur) => acc + cur.value, 0) / weekdayLogs.length : 0;
 
 if (weekendAvg > 0 && weekdayAvg > 0) {
 if (weekendAvg > weekdayAvg + 15) {
 attention.push("Weekend glucose remains significantly higher than weekdays.");
 } else if (weekendAvg < weekdayAvg - 5) {
 better.push("Weekend glucose has improved compared to weekdays.");
 }
 }

 if (recentLogs.length >= 20 && previousLogs.length > 0 && recentLogs.length > previousLogs.length * 1.2) {
 better.push("Logging consistency improved compared to last month.");
 } else if (recentLogs.length > 0 && previousLogs.length > 0 && recentLogs.length < previousLogs.length * 0.5) {
 attention.push("Logging consistency has declined compared to last month.");
 }

 if (recentLogs.length === 0) {
 attention.push("No glucose readings logged in the past 30 days.");
 } else if (recentLogs.length < 5) {
 attention.push("Long gaps exist between readings.");
 }

 if (recentLogs.length > 5) {
 if (recentFasting.count < 3) {
 attention.push("Too few fasting readings are available.");
 }
 if (recentPP.count < 3) {
 attention.push("Too few post-prandial readings are available.");
 }
 if (recentRandom.count > recentFasting.count + recentPP.count) {
 attention.push("Majority of your readings are random glucose values.");
 }
 }

 const needsQuality = attention.some(a => a.includes('Too few') || a.includes('random') || a.includes('Long gaps') || a.includes('consistency has declined') || a.includes('No glucose readings'));
 
 const hasRecentHbA1c = glucoseReadings.some(h => h.timing === 'HbA1c' && (() => { try { return new Date(h.date) >= subMonths(now, 4); } catch{return false;} })());

 if (needsQuality) {
 if (recentFasting.count < 4) recommendations.push("Record fasting glucose before breakfast on at least 4 mornings each week.");
 if (recentPP.count < 4) recommendations.push("Record post-prandial glucose 2 hours after dinner at least 3 times per week.");
 if (recentLogs.length === 0) recommendations.push("Start logging your glucose regularly to unlock insights.");
 else if (recentLogs.length < 5) recommendations.push("Avoid long gaps between glucose recordings.");
 if (recentRandom.count > recentFasting.count + recentPP.count) recommendations.push("Replace random glucose readings with fasting or post-meal readings whenever possible.");
 }

 if (!hasRecentHbA1c && recommendations.length < 3) {
 recommendations.push("Your HbA1c was last measured over 4 months ago. Consider repeating the test.");
 }
 
 if (recentFasting.count < 5 && recommendations.length < 3) {
 recommendations.push("Additional fasting readings are required before Expected HbA1c can be estimated.");
 }
 
 if (recentPP.count < 5 && recommendations.length < 3) {
 recommendations.push("Increase post-prandial readings to improve future analysis.");
 }

 if (recommendations.length < 3 && recentFasting.avg && recentFasting.avg > fastingLimit) {
 if (recentFasting.avg > 125) {
 recommendations.push("Discuss persistently elevated fasting glucose with your healthcare provider if it continues.");
 } else {
 recommendations.push("Continue monitoring fasting glucose until it reaches the target range.");
 }
 }
 
 if (recommendations.length < 3 && recentPP.avg && recentPP.avg > otherLimit) {
 recommendations.push("Monitor post-dinner glucose over the next week.");
 }

 if (recommendations.length < 3 && recentVariability > 60) {
 recommendations.push("Measure glucose at approximately the same time each day to help identify patterns.");
 }
 
 // De-duplicate better array simply
 const uniqueBetter = Array.from(new Set(better));
 const uniqueAttention = Array.from(new Set(attention));

 return {
 cards,
 better: uniqueBetter.slice(0, 4),
 attention: uniqueAttention.slice(0, 4),
 recommendations: recommendations.slice(0, 3)
 };
 }, [glucoseReadings]);

 const expectedHba1cData = useMemo(() => {
    const today = startOfDay(new Date());
    
    const readingsByDate = {};
    glucoseReadings.forEach(r => {
      try {
        const d = r.date.split('T')[0];
        if (!readingsByDate[d]) readingsByDate[d] = [];
        readingsByDate[d].push(r);
      } catch(e) {}
    });
    
    const allDates = Object.keys(readingsByDate).sort();
    const mostRecentDateStr = allDates.length > 0 ? allDates[allDates.length - 1] : null;
    
    let maxScore = -9999;
    let eligibleWindow = null;
    let bestWindowProgress = null;
    
    if (mostRecentDateStr) {
      const mostRecentDate = new Date(mostRecentDateStr + "T00:00:00");
      let currentI = 0; 
      let currentJ = 0; 
      let missed = 0;
      let valid = 0;
      
      while (currentJ < 90) { // Search up to 90 days backwards
        const dateJ = subDays(mostRecentDate, currentJ);
        const dateStrJ = format(dateJ, 'yyyy-MM-dd');
        
        if (readingsByDate[dateStrJ] && readingsByDate[dateStrJ].length > 0) {
          valid++;
        } else {
          missed++;
        }
        
        // Slide window forward (drop recent days) if missed days exceed 4
        while (missed > 4 && currentI <= currentJ) {
          const dateI = subDays(mostRecentDate, currentI);
          const dateStrI = format(dateI, 'yyyy-MM-dd');
          if (readingsByDate[dateStrI] && readingsByDate[dateStrI].length > 0) {
            valid--;
          } else {
            missed--;
          }
          currentI++;
        }
        
        const windowReadings = [];
        for (let k = currentI; k <= currentJ; k++) {
          const dateK = subDays(mostRecentDate, k);
          const dateStrK = format(dateK, 'yyyy-MM-dd');
          if (readingsByDate[dateStrK]) {
            windowReadings.push(...readingsByDate[dateStrK]);
          }
        }
        
        const daysTracked = valid;
        const missedDays = missed;
        const totalReadings = windowReadings.length;
        const fastingCount = windowReadings.filter(r => r.timing === 'Fasting').length;
        const postPrandialCount = windowReadings.filter(r => r.timing === 'Post-Prandial').length;
        
        const isEligible = daysTracked >= 28 && totalReadings >= 32 && fastingCount >= 12 && postPrandialCount >= 12;
        
        let expectedHba1c = 0;
        if (isEligible && totalReadings > 0) {
          const avgGlucose = windowReadings.reduce((sum, r) => sum + r.value, 0) / totalReadings;
          expectedHba1c = (avgGlucose + 46.7) / 28.7;
        }
        
        const currentData = {
          isEligible, 
          daysTracked, 
          missedDays, 
          totalReadings, 
          fastingCount, 
          postPrandialCount, 
          expectedHba1c,
          neededDays: Math.max(0, 28 - daysTracked),
          neededTotal: Math.max(0, 32 - totalReadings),
          neededFasting: Math.max(0, 12 - fastingCount),
          neededPP: Math.max(0, 12 - postPrandialCount)
        };
        
        if (isEligible) {
          if (!eligibleWindow) {
            eligibleWindow = currentData;
            break; // Found the most recent eligible window
          }
        }
        
        const score = (Math.min(28, valid) * 100) - (missed * 10) + (Math.min(32, totalReadings) * 2) + Math.min(12, fastingCount) + Math.min(12, postPrandialCount);
        
        if (score > maxScore) {
          maxScore = score;
          bestWindowProgress = currentData;
        }
        
        currentJ++;
      }
    }
    
    return eligibleWindow || bestWindowProgress || {
      isEligible: false, daysTracked: 0, missedDays: 0, totalReadings: 0, fastingCount: 0, postPrandialCount: 0, expectedHba1c: 0,
      neededDays: 28, neededTotal: 32, neededFasting: 12, neededPP: 12
    };
 }, [glucoseReadings]);

 useEffect(() => {
 if (selectedType === 'HbA1c' && timeFilter < 90) {
 setTimeFilter(90);
 } else if (selectedType !== 'HbA1c' && timeFilter === 180) {
 setTimeFilter(90);
 }
 }, [selectedType, timeFilter]);

 const hba1cReadings = useMemo(() => {
 return [...labReports]
 .filter(r => r.biomarkers.some(b => b.name.toLowerCase().includes('hba1c') || b.name.toLowerCase().includes('a1c')))
 .map(r => {
 const b = r.biomarkers.find(x => x.name.toLowerCase().includes('hba1c') || x.name.toLowerCase().includes('a1c'));
 return {
 id: r.id,
 date: r.date,
 time: '00:00',
 value: b!.value,
 timing: 'HbA1c' as any
 };
 })
 .sort((a,b) => {
 try { return parseISO(a.date).getTime() - parseISO(b.date).getTime(); } catch { return 0; }
 });
 }, [labReports]);

 const latestHba1c = hba1cReadings.length > 0 ? hba1cReadings[hba1cReadings.length - 1] : null;

 const uniqueGlucoseReadings = useMemo(() => {
 const sorted = [...glucoseReadings].sort((a,b) => b.createdAt - a.createdAt);
 const seen = new Set();
 const unique = [];
 for (const r of sorted) {
 const key = `${r.date}-${r.timing}`;
 if (!seen.has(key)) {
 seen.add(key);
 unique.push(r);
 }
 }
 return unique;
 }, [glucoseReadings]);

 const todayUniqueReadings = useMemo(() => {
 const todayStr = safeFormat(new Date(), 'yyyy-MM-dd');
 return uniqueGlucoseReadings.filter(r => r.date === todayStr);
 }, [uniqueGlucoseReadings]);

 // Chart data preparation
 const filteredReadings = useMemo(() => {
 let rawReadings: any[] = [];
 if (selectedType === 'HbA1c') {
 rawReadings = hba1cReadings;
 } else {
 rawReadings = uniqueGlucoseReadings.filter(r => r.timing === selectedType);
 }

 const filtered = rawReadings.filter(r => {
 try {
 return r.date ? isAfter(parseISO(r.date), subDays(new Date(), timeFilter)) : false;
 } catch { return false; }
 });

 const grouped = new Map<string, any>();
 filtered.forEach(r => {
 const ts = new Date(`${r.date}T${r.time || '00:00'}`).getTime();
 const existing = grouped.get(r.date);
 if (!existing || ts > existing.timestamp) {
 grouped.set(r.date, { ...r, timestamp: ts });
 }
 });

 return Array.from(grouped.values()).sort((a, b) => a.timestamp - b.timestamp);
 }, [glucoseReadings, hba1cReadings, timeFilter, selectedType]);

 const allFilteredForTimeline = useMemo(() => {
 return [...glucoseReadings].sort((a, b) => {
 try {
 const timeA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
 const timeB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
 return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
 } catch { return 0; }
 });
 }, [glucoseReadings]);

 // Statistics for selected type
 const stats = useMemo(() => {
 if (filteredReadings.length === 0) return { avg: '--', max: '--', min: '--', count: 0 };
 const values = filteredReadings.map(r => r.value);
 const sum = values.reduce((a, b) => a + b, 0);
 return {
 avg: Math.round((sum / values.length) * 10) / 10,
 max: Math.max(...values),
 min: Math.min(...values),
 count: values.length
 };
 }, [filteredReadings]);

 const getChartColor = (type: string) => {
 switch (type) {
 case 'Fasting': return '#10b981';
 case 'Post-Prandial': return '#ef4444';
 case 'Random': return '#3b82f6';
 case 'HbA1c': return '#9333ea';
 default: return '#888';
 }
 };

 const chartColor = getChartColor(selectedType);

 const getIdealRange = (type: string) => {
 switch (type) {
 case 'Fasting': return { min: 70, max: 99, text: '70 - 99 mg/dL' };
 case 'Post-Prandial': return { min: 70, max: 140, text: '< 140 mg/dL' };
 case 'Random': return { min: 70, max: 140, text: '< 140 mg/dL' };
 case 'HbA1c': return { min: 4.0, max: 5.6, text: '< 5.7 %' };
 default: return null;
 }
 };

 const idealRange = getIdealRange(selectedType);

 return (
 <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 mt-4 md:-mt-8">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <h2 className="text-4xl font-display font-medium text-theme-text tracking-tight">Glucose</h2>
 <div className="flex items-center gap-3 w-full sm:w-auto">
 <button 
 onClick={() => setShowAddModal(true)}
 className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-theme-accent to-theme-accent/80 hover:opacity-90 text-white px-5 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
 >
 <Plus size={18} />
 Add Reading
 </button>
 <button 
 onClick={() => setShowSugarHealth(true)}
 className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-violet-600 hover:opacity-90 text-white px-5 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
 >
 <Hexagon size={18} className="animate-[spin_4s_linear_infinite] opacity-80" />
 Sugar Health
 </button>
 </div>
 </div>

 {/* Premium Summary Cards */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* Today's Glucose */}
 <div className="bg-theme-card rounded-[32px] p-6 sm:p-8 border border-theme-border shadow-lg relative overflow-hidden group">
 <div className="absolute top-0 right-0 p-8 opacity-5">
 <Droplet size={100} fill="currentColor" />
 </div>
 <div className="relative z-10 flex flex-col h-full justify-between gap-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs font-bold text-theme-text-sec mb-1">Today's Reading</p>
 <h3 className="text-2xl font-display font-medium text-theme-text">Blood Glucose</h3>
 </div>
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-theme-accent/20 to-theme-accent/5 border border-theme-accent/20 flex items-center justify-center">
 <Droplet className="text-theme-accent" size={24} fill="currentColor" fillOpacity={0.2} />
 </div>
 </div>

 <div className="flex flex-col gap-4">
 {todayUniqueReadings.length > 0 ? (
 todayUniqueReadings.map((reading) => {
 const range = getIdealRange(reading.timing);
 let isNormal = true;
 if (range) {
 if (range.min && reading.value < range.min) isNormal = false;
 if (range.max && reading.value > range.max) isNormal = false;
 }
 
 return (
 <div key={reading.id} className="flex flex-col xl:flex-row xl:items-center justify-between border-t border-theme-border/50 pt-5 first:border-0 first:pt-0 gap-4">
 <div className="flex items-baseline gap-2">
 <span className="text-5xl font-black tracking-tighter text-theme-text">{reading.value}</span>
 <span className="text-sm font-bold text-theme-text-sec">mg/dL</span>
 <div className="ml-2 flex items-center justify-center bg-theme-bg/50 rounded-full p-1" title={isNormal ? 'Normal' : 'Out of range'}>
 {isNormal ? <Check className="text-theme-success" size={16} strokeWidth={3.5} /> : <AlertTriangle className="text-amber-500" size={14} strokeWidth={3} />}
 </div>
 </div>
 <div className="flex flex-row xl:flex-col items-center xl:items-end gap-3 xl:gap-2 flex-wrap">
 <div className="flex items-center gap-1.5 bg-theme-bg px-2.5 py-1 rounded-full border border-theme-border/50">
 <div className={cn(
 "w-2 h-2 rounded-full shrink-0", 
 reading.timing === 'Fasting' ? "bg-green-500" : 
 reading.timing === 'Random' ? "bg-blue-500" : 
 "bg-red-500"
 )} />
 <span className="text-[10px] font-bold text-theme-text">
 {reading.timing}
 </span>
 </div>
 <div className="flex items-center gap-2 text-xs font-medium text-theme-text-sec">
 {reading.hoursAfterEating !== undefined && (
 <span>{reading.hoursAfterEating}h post-meal</span>
 )}
 <span className="font-bold bg-theme-bg px-2 py-1 rounded-md border border-theme-border/30">{reading.time}</span>
 </div>
 </div>
 </div>
 );
 })
 ) : (
 <div className="flex flex-col gap-6">
 <div className="flex items-baseline gap-2">
 <span className="text-5xl lg:text-6xl font-black tracking-tighter text-theme-text opacity-20">--</span>
 <span className="text-base lg:text-lg font-bold text-theme-text-sec opacity-20">mg/dL</span>
 </div>
 <div className="flex items-center justify-between border-t border-theme-border/50 pt-4">
 <span className="text-sm font-medium text-theme-text-sec">No reading logged today</span>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Latest HbA1c Wrapper */}
 <div className="flex flex-col gap-6">
 {/* Latest HbA1c */}

 <div className="bg-theme-card rounded-[32px] p-6 sm:p-8 border border-theme-border shadow-lg relative overflow-hidden group">
 <div className="absolute top-0 right-0 p-8 opacity-5">
 <Hexagon size={100} />
 </div>
 <div className="relative z-10 flex flex-col h-full justify-between gap-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs font-bold text-theme-text-sec mb-1">Laboratory</p>
 <h3 className="text-2xl font-display font-medium text-theme-text">Latest HbA1c</h3>
 </div>
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/20 flex items-center justify-center">
 <Hexagon className="text-purple-500" size={24} />
 </div>
 </div>

 <div>
 {latestHba1c ? (
 <div className="flex items-baseline gap-2">
 <span className="text-5xl lg:text-6xl font-black tracking-tighter text-theme-text">{latestHba1c.value}</span>
 <span className="text-base lg:text-lg font-bold text-theme-text-sec">%</span>
 </div>
 ) : (
 <div className="flex items-baseline gap-2">
 <span className="text-5xl lg:text-6xl font-black tracking-tighter text-theme-text opacity-20">--</span>
 <span className="text-base lg:text-lg font-bold text-theme-text-sec opacity-20">%</span>
 </div>
 )}
 </div>

 <div className="flex flex-col xl:flex-row xl:items-center justify-between border-t border-theme-border/50 pt-4 gap-3">
 {latestHba1c ? (
 <>
 <span className="text-sm font-medium text-theme-text-sec">
 Tested on {safeFormat(latestHba1c.date, 'MMM d, yyyy')}
 </span>
 <span className={cn(
 "px-3 py-1 rounded-xl text-xs font-bold w-fit",
 latestHba1c.value < 5.7 ? "bg-theme-success/10 text-theme-success" :
 latestHba1c.value < 6.5 ? "bg-amber-500/10 text-amber-500" :
 "bg-theme-critical/10 text-theme-critical"
 )}>
 {latestHba1c.value < 5.7 ? 'Normal' : latestHba1c.value < 6.5 ? 'Prediabetes' : 'Diabetes'}
 </span>
 </>
 ) : (
 <span className="text-sm font-medium text-theme-text-sec">Upload a lab report to track HbA1c</span>
 )}
 </div>
 </div>
 </div>

 {/* Expected HbA1c Entry Card */}
 <div 
 onClick={() => {
 if (!hasCalculated) {
 if (expectedHba1cData.isEligible) {
 setHasCalculated(true);
 } else {
 setShowCriteriaModal(true);
 }
 }
 }}
 className="mx-auto sm:mx-0 w-[85%] sm:w-[75%] lg:w-[70%] bg-theme-card rounded-[16px] px-5 py-3.5 border border-theme-border shadow-sm flex items-center justify-between group cursor-pointer hover:shadow-md transition-shadow"
 >
 <div className="flex flex-col gap-1">
 <div className="flex items-center gap-1.5">
 <h3 className="text-[15px] sm:text-base font-bold text-theme-text leading-none">
 Expected HbA1c
 </h3>
 <button onClick={(e) => { e.stopPropagation(); setShowHba1cInfo(true); }} className="text-theme-text-sec hover:text-theme-text transition-colors" title="Learn more">
 <Info size={14} />
 </button>
 </div>
 <p className="text-[13px] font-medium text-theme-text-sec leading-none">
 Estimate from glucose readings
 </p>
 </div>
 
 <div className="flex justify-end shrink-0 pl-4">
 {hasCalculated && expectedHba1cData.isEligible ? (
 <div className="flex items-baseline gap-0.5">
 <span className="text-xl font-black tracking-tight text-theme-text">{expectedHba1cData.expectedHba1c.toFixed(1)}</span>
 <span className="text-xs font-bold text-theme-text-sec">%</span>
 </div>
 ) : (
 <div className="text-theme-text-sec flex items-center justify-center transition-colors">
 <div className="transform group-hover:translate-x-1 transition-all duration-300">
 <ChevronRight size={18} strokeWidth={2.5} />
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* Chart Section */}
 <div className="bg-gradient-to-br from-theme-card to-theme-card-sec/30 p-6 sm:p-8 rounded-[32px] border border-theme-border shadow-lg relative overflow-hidden">
 {/* Decorative background blur */}
 <div className="absolute -top-40 -right-40 w-80 h-80 bg-theme-accent/5 rounded-full blur-3xl pointer-events-none" />
 
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 relative z-10">
 <div className="flex flex-wrap items-center gap-2">
 {(['Fasting', 'Random', 'Post-Prandial', 'HbA1c'] as const).map(type => (
 <button
 key={type}
 onClick={() => setSelectedType(type)}
 className={cn(
 "px-3 py-1.5 text-sm font-bold transition-all border-b-2 rounded-none",
 selectedType === type 
 ? "border-theme-text text-theme-text" 
 : "border-transparent text-theme-text-sec hover:text-theme-text"
 )}
 >
 {type}
 </button>
 ))}
 </div>
 <div className="bg-theme-card-sec rounded-xl p-1">
 <select 
 value={timeFilter} 
 onChange={(e) => setTimeFilter(Number(e.target.value))}
 className="text-xs font-bold text-theme-text-sec bg-transparent py-1 px-2 focus:outline-none cursor-pointer"
 >
 {selectedType === 'HbA1c' ? (
 <>
 <option value={90}>90 Days</option>
 <option value={180}>180 Days</option>
 <option value={365}>1 Year</option>
 <option value={9999}>Lifetime</option>
 </>
 ) : (
 <>
 <option value={7}>7 Days</option>
 <option value={30}>30 Days</option>
 <option value={90}>90 Days</option>
 <option value={365}>1 Year</option>
 <option value={9999}>Lifetime</option>
 </>
 )}
 </select>
 </div>
 </div>

 {idealRange && (
 <div className="mb-4 flex items-center gap-2 bg-theme-success/10 text-theme-success border border-theme-success/20 px-3 py-2 rounded-xl text-xs font-bold w-max">
 <Info size={14} />
 <span>Target Range: {idealRange.text}</span>
 </div>
 )}

 <div className="h-[320px] w-full relative mt-4 pb-4">
 {filteredReadings.length > 0 ? (
 <ResponsiveContainer width="100%" height="100%">
 <ComposedChart data={filteredReadings} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
 <defs>
 <linearGradient id="colorSelected" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor={chartColor} stopOpacity={0.35}/>
 <stop offset="100%" stopColor={chartColor} stopOpacity={0.0}/>
 </linearGradient>
 <pattern id="diagonal-stripe" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
 <rect width="4" height="8" transform="translate(0,0)" fill="var(--color-theme-success)" fillOpacity={0.1}></rect>
 </pattern>
 </defs>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-theme-border)" opacity={0.4} />
 
 {idealRange && (
 <ReferenceArea y1={idealRange.min} y2={idealRange.max} {...({ fill: "url(#diagonal-stripe)" } as any)} />
 )}
 {idealRange && idealRange.max && (
 <ReferenceLine y={idealRange.max} stroke="var(--color-theme-success)" strokeDasharray="3 3" opacity={0.5} strokeWidth={2} />
 )}
 {idealRange && idealRange.min && (
 <ReferenceLine y={idealRange.min} stroke="var(--color-theme-success)" strokeDasharray="3 3" opacity={0.5} strokeWidth={2} />
 )}

 <XAxis 
 type="number"
 scale="time"
 domain={['auto', new Date().getTime()]}
 dataKey="timestamp" 
 tickFormatter={(tick) => safeFormat(new Date(tick), 'MMM d')} 
 axisLine={false} 
 tickLine={false} 
 tick={{ fontSize: 10, fill: 'var(--color-theme-text-sec)', fontWeight: 600 }} 
 dy={10}
 angle={0}
 textAnchor="middle"
 height={30}
 minTickGap={40} 
 />
 <YAxis 
 axisLine={false} 
 tickLine={false} 
 tick={{ fontSize: 11, fill: 'var(--color-theme-text-sec)', fontWeight: 500 }} 
 dx={-10}
 />
 <Tooltip content={<CustomTooltip chartColor={chartColor} unit={selectedType === 'HbA1c' ? '%' : 'mg/dL'} />} />
 
 <Area type="monotone" dataKey="value" stroke="none" fill="url(#colorSelected)" connectNulls />
 <Line type="monotone" dataKey="value" stroke={chartColor} strokeWidth={4} dot={<CustomDot chartColor={chartColor} idealRange={idealRange} timeFilter={timeFilter} />} activeDot={{ r: 6, strokeWidth: 3, fill: 'var(--color-theme-card)', stroke: chartColor }} connectNulls />
 </ComposedChart>
 </ResponsiveContainer>
 ) : (
 <div className="h-full flex flex-col items-center justify-center text-theme-text-sec space-y-3">
 <Activity size={32} className="opacity-20" />
 <p>No reading data for this period.</p>
 </div>
 )}
 </div>

 {/* Statistics for selected type */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-theme-border">
 <div>
 <p className="text-[10px] font-bold text-theme-text-sec ">Average</p>
 <p className="text-xl font-bold text-theme-text">{stats.avg} <span className="text-xs font-normal">{selectedType === 'HbA1c' ? '%' : 'mg/dL'}</span></p>
 </div>
 <div>
 <p className="text-[10px] font-bold text-theme-text-sec ">Highest</p>
 <p className="text-xl font-bold text-theme-text">{stats.max} <span className="text-xs font-normal">{selectedType === 'HbA1c' ? '%' : 'mg/dL'}</span></p>
 </div>
 <div>
 <p className="text-[10px] font-bold text-theme-text-sec ">Lowest</p>
 <p className="text-xl font-bold text-theme-text">{stats.min} <span className="text-xs font-normal">{selectedType === 'HbA1c' ? '%' : 'mg/dL'}</span></p>
 </div>
 <div>
 <p className="text-[10px] font-bold text-theme-text-sec ">Readings</p>
 <p className="text-xl font-bold text-theme-text">{stats.count}</p>
 </div>
 </div>
 </div>

 {/* Reading Timeline */}
 <div className="bg-theme-card p-6 sm:p-8 rounded-[32px] border border-theme-border shadow-md">
 <h3 className="text-xl font-display font-medium text-theme-text mb-4 flex items-center gap-2">
 Reading Timeline
 </h3>
 {allFilteredForTimeline.length === 0 ? (
 <p className="text-sm text-theme-text-sec py-4 text-center">No readings logged yet.</p>
 ) : (
 <div className="space-y-3">
 {(showAllTimeline ? allFilteredForTimeline : allFilteredForTimeline.slice(0, 7)).map((reading) => (
 <div key={reading.id} className="flex items-center justify-between p-5 rounded-3xl border border-theme-border/50 bg-theme-bg hover:bg-theme-card-sec transition-all shadow-sm hover:shadow-md group">
 <div className="flex items-center gap-5">
 <div className="w-16 h-16 rounded-[24px] bg-theme-card border border-theme-border/60 flex items-center justify-center text-theme-text font-black text-2xl shadow-sm">
 {reading.value}
 </div>
 <div>
 <div className="flex items-center gap-2 mb-1.5">
 <div className="flex items-center gap-1.5">
 <div className={cn(
 "w-2 h-2 rounded-full",
 reading.timing === 'Fasting' ? "bg-green-500" :
 reading.timing === 'Random' ? "bg-blue-500" :
 "bg-red-500"
 )} />
 <span className="text-[11px] font-bold text-theme-text">
 {reading.timing}
 </span>
 </div>
 {reading.source === 'OCR' && (
 <span className="text-[9px] px-2 py-1 rounded-lg bg-purple-500/10 text-purple-500 font-bold ">
 AI Read
 </span>
 )}
 </div>
 <p className="text-sm font-bold text-theme-text flex items-center gap-1.5">
 {safeFormat(reading.date, 'MMM d, yyyy')} <span className="text-theme-text-sec font-medium">at</span> {reading.time}
 </p>
 {reading.hoursAfterEating !== undefined && (
 <p className="text-xs text-theme-text-sec mt-1 font-medium">
 {reading.hoursAfterEating}h after eating
 </p>
 )}
 </div>
 </div>
 <button 
 onClick={() => removeGlucoseReading(reading.id)}
 className="p-3 text-theme-text-sec hover:text-theme-critical hover:bg-theme-critical/10 rounded-2xl transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
 title="Delete reading"
 >
 <Trash2 size={18} />
 </button>
 </div>
 ))}
 
 {allFilteredForTimeline.length > 7 && (
 <button 
 onClick={() => setShowAllTimeline(!showAllTimeline)}
 className="w-full mt-4 py-3 border border-theme-border rounded-xl text-theme-text-sec text-sm font-bold hover:bg-theme-card-sec transition-colors"
 >
 {showAllTimeline ? 'Show Less' : `View All ${allFilteredForTimeline.length} Readings`}
 </button>
 )}
 </div>
 )}
 </div>

 {showAddModal && <AddGlucoseModal onClose={() => setShowAddModal(false)} onAdd={async (r) => { try { await addGlucoseReading(r); setShowAddModal(false); } catch(e: any) { alert(e.message || "Failed to add reading"); } }} />}
 
 {showCriteriaModal && (
 <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowCriteriaModal(false)}>
 <div className="bg-theme-card dark:bg-[#0f172a] w-full sm:w-[450px] max-h-[90vh] overflow-y-auto rounded-t-[32px] sm:rounded-[32px] shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 border border-theme-border dark:border-indigo-900/50" onClick={e => e.stopPropagation()}>
 <div className="sticky top-0 bg-theme-card/90 dark:bg-[#0f172a]/90 backdrop-blur-md z-10 flex items-center justify-between p-6 border-b border-theme-border dark:border-indigo-900/50">
 <h3 className="text-xl font-display font-medium text-theme-text dark:text-white">Unlock Expected HbA1c</h3>
 <button onClick={() => setShowCriteriaModal(false)} className="w-8 h-8 rounded-full bg-theme-bg dark:bg-indigo-900/30 flex items-center justify-center text-theme-text-sec dark:text-indigo-300 hover:text-theme-text dark:hover:text-white transition-colors">
 <X size={18} />
 </button>
 </div>
 <div className="p-5 sm:p-6">
 <p className="text-theme-text-sec dark:text-indigo-100 font-medium mb-8">Keep logging glucose to unlock your Expected HbA1c.</p>
 <div className="space-y-4">
 <p className="text-sm font-sans font-bold capitalize tracking-normal text-theme-text dark:text-white mb-2">Progress so far:</p>
 
 <div className="space-y-5">
 <div>
 <div className="flex justify-between items-center mb-2">
 <div className="flex items-center gap-2">
 {expectedHba1cData.daysTracked >= 28 ? <CheckCircle2 size={16} className="text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-theme-border/50"></div>}
 <span className="text-sm text-theme-text-sec dark:text-indigo-200 font-medium">28 days of tracking</span>
 </div>
 <span className={`text-sm font-bold ${expectedHba1cData.daysTracked >= 28 ? 'text-emerald-500' : 'text-theme-text dark:text-white'}`}>{expectedHba1cData.daysTracked} / 28</span>
 </div>
 <div className="w-full bg-theme-bg dark:bg-indigo-900/50 rounded-full h-2 overflow-hidden">
 <div className={`h-full rounded-full transition-all ${expectedHba1cData.daysTracked >= 28 ? 'bg-emerald-500' : 'bg-theme-accent dark:bg-indigo-500'}`} style={{ width: `${Math.min(100, (expectedHba1cData.daysTracked / 28) * 100)}%` }}></div>
 </div>
 </div>
 
 <div>
 <div className="flex justify-between items-center mb-2">
 <div className="flex items-center gap-2">
 {expectedHba1cData.totalReadings >= 32 ? <CheckCircle2 size={16} className="text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-theme-border/50"></div>}
 <span className="text-sm text-theme-text-sec dark:text-indigo-200 font-medium">32 total readings</span>
 </div>
 <span className={`text-sm font-bold ${expectedHba1cData.totalReadings >= 32 ? 'text-emerald-500' : 'text-theme-text dark:text-white'}`}>{expectedHba1cData.totalReadings} / 32</span>
 </div>
 <div className="w-full bg-theme-bg dark:bg-indigo-900/50 rounded-full h-2 overflow-hidden">
 <div className={`h-full rounded-full transition-all ${expectedHba1cData.totalReadings >= 32 ? 'bg-emerald-500' : 'bg-theme-accent dark:bg-indigo-500'}`} style={{ width: `${Math.min(100, (expectedHba1cData.totalReadings / 32) * 100)}%` }}></div>
 </div>
 </div>

 <div>
 <div className="flex justify-between items-center mb-2">
 <div className="flex items-center gap-2">
 {expectedHba1cData.fastingCount >= 12 ? <CheckCircle2 size={16} className="text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-theme-border/50"></div>}
 <span className="text-sm text-theme-text-sec dark:text-indigo-200 font-medium">12 fasting readings</span>
 </div>
 <span className={`text-sm font-bold ${expectedHba1cData.fastingCount >= 12 ? 'text-emerald-500' : 'text-theme-text dark:text-white'}`}>{expectedHba1cData.fastingCount} / 12</span>
 </div>
 <div className="w-full bg-theme-bg dark:bg-indigo-900/50 rounded-full h-2 overflow-hidden">
 <div className={`h-full rounded-full transition-all ${expectedHba1cData.fastingCount >= 12 ? 'bg-emerald-500' : 'bg-theme-accent dark:bg-indigo-500'}`} style={{ width: `${Math.min(100, (expectedHba1cData.fastingCount / 12) * 100)}%` }}></div>
 </div>
 </div>

 <div>
 <div className="flex justify-between items-center mb-2">
 <div className="flex items-center gap-2">
 {expectedHba1cData.postPrandialCount >= 12 ? <CheckCircle2 size={16} className="text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-theme-border/50"></div>}
 <span className="text-sm text-theme-text-sec dark:text-indigo-200 font-medium">12 post-prandial readings</span>
 </div>
 <span className={`text-sm font-bold ${expectedHba1cData.postPrandialCount >= 12 ? 'text-emerald-500' : 'text-theme-text dark:text-white'}`}>{expectedHba1cData.postPrandialCount} / 12</span>
 </div>
 <div className="w-full bg-theme-bg dark:bg-indigo-900/50 rounded-full h-2 overflow-hidden">
 <div className={`h-full rounded-full transition-all ${expectedHba1cData.postPrandialCount >= 12 ? 'bg-emerald-500' : 'bg-theme-accent dark:bg-indigo-500'}`} style={{ width: `${Math.min(100, (expectedHba1cData.postPrandialCount / 12) * 100)}%` }}></div>
 </div>
 </div>
 
 <div>
 <div className="flex justify-between items-center mb-2">
 <div className="flex items-center gap-2">
 {expectedHba1cData.missedDays <= 4 ? <CheckCircle2 size={16} className="text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-theme-border/50"></div>}
 <span className="text-sm text-theme-text-sec dark:text-indigo-200 font-medium">Maximum 4 missed days</span>
 </div>
 <span className={`text-sm font-bold ${expectedHba1cData.missedDays <= 4 ? 'text-emerald-500' : 'text-theme-text dark:text-white'}`}>{expectedHba1cData.missedDays} / 4</span>
 </div>
 <div className="w-full bg-theme-bg dark:bg-indigo-900/50 rounded-full h-2 overflow-hidden">
 <div className={`h-full rounded-full transition-all ${expectedHba1cData.missedDays > 4 ? 'bg-red-500' : expectedHba1cData.missedDays === 0 ? 'bg-emerald-500 w-full' : 'bg-amber-500'}`} style={{ width: expectedHba1cData.missedDays === 0 ? '100%' : `${Math.min(100, (expectedHba1cData.missedDays / 4) * 100)}%` }}></div>
 </div>
 </div>
 </div>
 </div>
 
 <button onClick={() => setShowCriteriaModal(false)} className="w-full mt-10 py-3.5 rounded-2xl bg-theme-text text-theme-bg hover:opacity-90 dark:bg-white dark:text-[#0f172a] font-bold transition-all shadow-md">
 Continue Logging
 </button>
 </div>
 </div>
 </div>
 )}

 {showHba1cInfo && (
 <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowHba1cInfo(false)}>
 <div className="bg-theme-card w-full sm:w-[500px] max-h-[90vh] overflow-y-auto rounded-t-[32px] sm:rounded-[32px] shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
 <div className="sticky top-0 bg-theme-card/90 backdrop-blur-md z-10 flex items-center justify-between p-6 border-b border-theme-border">
 <h3 className="text-xl font-display font-medium text-theme-text">Expected HbA1c</h3>
 <button onClick={() => setShowHba1cInfo(false)} className="w-8 h-8 rounded-full bg-theme-bg flex items-center justify-center text-theme-text-sec hover:text-theme-text transition-colors">
 <X size={18} />
 </button>
 </div>
 <div className="p-6 space-y-4">
 <p className="text-theme-text font-medium">Expected HbA1c provides an approximation of your laboratory HbA1c using your logged glucose readings.</p>
 <div className="p-4 bg-theme-accent/10 text-theme-accent font-medium rounded-2xl text-sm border border-theme-accent/20">
 It is not a replacement for a laboratory HbA1c test.
 </div>
 
 <div>
 <h4 className="text-sm font-bold text-theme-text-sec mb-3">How is it calculated?</h4>
 <p className="text-theme-text text-sm mb-3">We calculate your average glucose from your logged readings and estimate your HbA1c using the internationally published ADAG equation.</p>
 <div className="p-4 bg-theme-bg rounded-2xl font-mono text-xs text-theme-text-sec border border-theme-border/50 text-center">
 HbA1c (%) = (Average Glucose + 46.7) / 28.7
 </div>
 <p className="text-xs text-theme-text-sec mt-3 italic">Source: A1c-Derived Average Glucose (ADAG) Study.</p>
 </div>

 <div className="pt-6 border-t border-theme-border/50">
 <h4 className="text-sm font-bold text-theme-text-sec mb-3">When is an estimate available?</h4>
 <p className="text-theme-text text-sm mb-4">To improve reliability, Bluepin generates an estimate only after you have:</p>
 <ul className="space-y-3">
 <li className="flex items-center gap-3 text-sm text-theme-text font-medium"><div className="w-1.5 h-1.5 rounded-full bg-theme-accent" /> At least 28 continuous days of DAILY tracking</li>
 <li className="flex items-center gap-3 text-sm text-theme-text font-medium"><div className="w-1.5 h-1.5 rounded-full bg-theme-accent" /> At least 32 total readings in this period</li>
 <li className="flex items-center gap-3 text-sm text-theme-text font-medium"><div className="w-1.5 h-1.5 rounded-full bg-theme-accent" /> ≥12 fasting readings in this period</li>
 <li className="flex items-center gap-3 text-sm text-theme-text font-medium"><div className="w-1.5 h-1.5 rounded-full bg-theme-accent" /> ≥12 post-prandial readings</li>
 <li className="flex items-center gap-3 text-sm text-theme-text font-medium"><div className="w-1.5 h-1.5 rounded-full bg-theme-accent" /> Maximum of 4 missed days</li>
 </ul>
 <p className="text-theme-text-sec text-sm mt-4">If these requirements are not met, we'll guide you on what's still needed.</p>
 </div>
 </div>
 </div>
 </div>
 )}

 {showSugarHealth && (
 <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-theme-bg/80 backdrop-blur-sm animate-in fade-in duration-200">
 <div className="bg-theme-card border border-theme-border rounded-[32px] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
 <div className="sticky top-0 bg-theme-card/90 backdrop-blur-md z-10 flex items-center justify-between p-6 sm:p-8 border-b border-theme-border">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 text-purple-500">
 <Hexagon size={20} className="animate-[spin_4s_linear_infinite]" />
 </div>
 <h3 className="text-2xl font-bold text-theme-text font-sans tracking-tight">Sugar Health</h3>
 </div>
 <button onClick={() => setShowSugarHealth(false)} className="w-10 h-10 rounded-full bg-theme-bg flex items-center justify-center text-theme-text-sec hover:text-theme-text transition-colors border border-theme-border">
 <X size={20} />
 </button>
 </div>
 <div className="p-6 sm:p-8 space-y-8">
 {sugarInsights ? (
 <div className="space-y-8">

 <div className="grid grid-cols-3 gap-3">
 {[
 { label: 'Fasting', data: sugarInsights.cards.fasting, color: 'text-green-500', bg: 'bg-green-500/10' },
 { label: 'Post-Meal', data: sugarInsights.cards.pp, color: 'text-red-500', bg: 'bg-red-500/10' },
 { label: 'Random', data: sugarInsights.cards.random, color: 'text-blue-500', bg: 'bg-blue-500/10' }
 ].map((card, i) => (
 <div key={i} className="p-4 rounded-2xl bg-theme-bg border border-theme-border flex flex-col justify-center items-center text-center">
 <span className="text-[10px] sm:text-xs font-bold text-theme-text-sec mb-2">{card.label}</span>
 {card.data.avg ? (
 <>
 <span className="text-xl sm:text-2xl font-black text-theme-text">{card.data.avg} <span className="text-[10px] sm:text-xs text-theme-text-sec font-medium">mg/dL</span></span>
 {card.data.diff !== null && (
 <span className={`text-[10px] sm:text-xs font-bold mt-1 ${card.data.diff > 0 ? 'text-amber-500' : 'text-green-500'}`}>
 {card.data.diff > 0 ? '↑' : '↓'} {Math.abs(card.data.diff)} mg/dL
 </span>
 )}
 </>
 ) : (
 <span className="text-sm font-medium text-theme-text-sec">Not enough data</span>
 )}
 </div>
 ))}
 </div>

 {sugarInsights.better.length > 0 && (
 <div className="space-y-3">
 <h4 className="text-lg font-bold text-theme-text tracking-tight flex items-center gap-2">
 <Check className="text-green-500" size={18} /> What's Better
 </h4>
 <ul className="space-y-2 text-theme-text-sec text-sm list-disc list-inside marker:text-green-500/50">
 {sugarInsights.better.map((item, i) => (
 <li key={i} className="pl-1">{item}</li>
 ))}
 </ul>
 </div>
 )}

 {sugarInsights.attention.length > 0 && (
 <div className="space-y-3">
 <h4 className="text-lg font-bold text-theme-text tracking-tight flex items-center gap-2">
 <AlertCircle className="text-amber-500" size={18} /> Needs Attention
 </h4>
 <ul className="space-y-2 text-theme-text-sec text-sm list-disc list-inside marker:text-amber-500/50">
 {sugarInsights.attention.map((item, i) => (
 <li key={i} className="pl-1">{item}</li>
 ))}
 </ul>
 </div>
 )}

 {sugarInsights.recommendations.length > 0 && (
 <div className="space-y-3">
 <h4 className="text-lg font-bold text-theme-text tracking-tight flex items-center gap-2">
 💡 Recommendations
 </h4>
 <ul className="space-y-2 text-theme-text-sec text-sm list-disc list-inside marker:text-theme-accent/50">
 {sugarInsights.recommendations.map((item, i) => (
 <li key={i} className="pl-1">{item}</li>
 ))}
 </ul>
 </div>
 )}
 </div>
 ) : (
 <div className="text-center py-8">
 <div className="w-16 h-16 rounded-full bg-theme-bg mx-auto flex items-center justify-center mb-4">
 <Activity className="text-theme-text-sec" size={24} />
 </div>
 <p className="font-bold text-theme-text">Not enough data</p>
 <p className="text-sm text-theme-text-sec mt-2">Log more glucose readings to unlock your Sugar Health.</p>
 </div>
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 );
}

export function AddGlucoseModal({ onClose, onAdd }: { onClose: () => void, onAdd: (r: GlucoseReading) => Promise<void> }) {
 const [val, setVal] = useState('');
 const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ev = { target: { files: [file] } } as any;
      handleFileUpload(ev);
    }
  };
 const [errorObj, setErrorObj] = useState<string|null>(null);
 const [imageUrlData, setImageUrlData] = useState<string|undefined>(undefined);
  const [source, setSource] = useState<'Manual' | 'OCR'>('Manual');
 
 const [hoursAgo, setHoursAgo] = useState<string>('');

 const calculateTiming = (hoursStr: string): MealTiming => {
 const hours = parseFloat(hoursStr);
 if (isNaN(hours)) return 'Random';
 if (hours >= 8) return 'Fasting';
 if (hours <= 2) return 'Post-Prandial';
 return 'Random';
 };

 const { glucoseReadings } = useAppStore();

 const [isSubmitting, setIsSubmitting] = useState(false); const handleManualSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!val || isNaN(Number(val)) || !hoursAgo || isNaN(Number(hoursAgo))) {
 setErrorObj("Please enter both a valid glucose value and hours after eating.");
 return;
 }

 const timing = calculateTiming(hoursAgo);
 const date = safeFormat(new Date(), 'yyyy-MM-dd');
 const existingReading = glucoseReadings.find(r => r.date === date && r.timing === timing);

 const reading: GlucoseReading = {
 id: existingReading ? existingReading.id : uuidv4(),
 value: Number(val),
 unit: 'mg/dL',
 timing,
 hoursAfterEating: Number(hoursAgo),
 source,
 imageUrl: imageUrlData,
 date,
 time: safeFormat(new Date(), 'HH:mm'),
 createdAt: existingReading ? existingReading.createdAt : Date.now()
 };
 setIsSubmitting(true); try { await onAdd(reading); } catch(err: any) { setErrorObj(err.message || "Failed to add reading"); } finally { setIsSubmitting(false); }
 };
 
 const processFile = async (file: File) => {
 setIsUploading(true);
 setErrorObj(null);
 try {
 const getBase64 = (file: File) => new Promise<string>((resolve, reject) => {
 const reader = new FileReader();
 reader.readAsDataURL(file);
 reader.onload = () => resolve((reader.result as string).split(',')[1]);
 reader.onerror = error => reject(error);
 });

 const base64Str = await getBase64(file);
 const chunkSize = 10 * 1024 * 1024;
 const totalChunks = Math.ceil(base64Str.length / chunkSize);
 const uploadId = uuidv4();

 let data: any = null;

 for (let i = 0; i < totalChunks; i++) {
 const chunkData = base64Str.slice(i * chunkSize, (i + 1) * chunkSize);
 
 const res = await fetch('/api/upload-chunk', {
 method: 'POST',
 headers: { 'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`, 'Content-Type': 'application/json' },
 body: JSON.stringify({
 uploadId,
 chunkIndex: i,
 totalChunks,
 chunkData,
 mimeType: file.type || 'image/jpeg',
 type: 'glucose'
 })
 });

 if (!res.ok) {
 const text = await res.text();
 let parsed;
 try { parsed = JSON.parse(text); } catch (e) {}
 if (parsed?.details?.includes('503') || parsed?.details?.includes('UNAVAILABLE') || parsed?.details?.includes('high demand')) {
 throw new Error("The AI model is currently experiencing high demand. Please wait a moment and try again.");
 }
 const errDetails = typeof parsed?.details === 'object' ? JSON.stringify(parsed.details) : parsed?.details;
          throw new Error(parsed?.error || errDetails || text || `HTTP Error ${res.status}`);
 }

 const resData = await res.json();
 if (i === totalChunks - 1) {
 data = resData;
 }
 }
 
 if (data?.success && data.value) {
 setVal(data.value.toString());
 setSource('OCR');
 setImageUrlData(""); 
 } else {
 setErrorObj(data?.errorMsg || "Could not extract glucose reading.");
 }
 } catch (err: any) {
 console.error(err);
 setErrorObj(err.message || "Failed to process image.");
 } finally {
 setIsUploading(false);
 }
 };

 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
 e.target.value = '';
 await processFile(file);
 };

  
  
 
 const currentTiming = calculateTiming(hoursAgo);

  
return (
 <div  
   className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity" 
   onDragOver={handleDragOver} 
   onDragLeave={handleDragLeave} 
   onDrop={handleDrop} 
 > 
   {isDragging && ( 
     <div className="absolute inset-0 z-[70] bg-theme-accent/20 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-none"> 
       <div className="bg-theme-card p-8 rounded-3xl shadow-xl flex flex-col items-center max-w-sm w-full text-center scale-up border-theme-accent border-dashed border-2"> 
         <UploadCloud size={64} className="text-theme-accent mb-4" /> 
         <h3 className="text-xl font-bold text-theme-text mb-2">Drop photo here</h3> 
         <p className="text-theme-text-sec text-sm">Release to analyze your glucometer reading automatically.</p> 
       </div> 
     </div> 
   )} 
   
   <div className={cn("bg-theme-card rounded-[32px] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 transition-all z-10", isDragging ? "scale-[0.98] opacity-50" : "")}> 
     <div className="p-5 sm:p-6"> 
       <div className="flex justify-between items-center mb-4">
         <h3 className="text-2xl font-display font-medium text-theme-text">Add Reading</h3> 
         <button onClick={onClose} className="p-2 -mr-2 text-theme-text-sec hover:text-theme-text transition-colors">
            <X size={24} />
         </button>
       </div>
       
       {errorObj && ( 
         <div className="mb-4 text-sm text-theme-critical bg-theme-critical/10 p-3 rounded-2xl border border-theme-critical/20 flex items-start gap-2"> 
           <Info size={16} className="mt-0.5 shrink-0" /> 
           <span>{typeof errorObj === 'object' ? JSON.stringify(errorObj) : errorObj}</span>
           {errorObj && (errorObj.includes('Invalid') || errorObj.includes('size') || errorObj.includes('type')) && (
             <div className="text-xs mt-1 opacity-80">
                Allowed formats: PDF, PNG, JPEG, JPG. Maximum file size: 10 MB.
             </div>
           )} 
         </div> 
       )} 
       
       <div className="flex justify-center mb-4 w-full"> 
         <input 
           id="glucose-upload" 
           type="file" 
           accept="image/png, image/jpeg, image/jpg, application/pdf" 
           className="hidden" 
           onChange={handleFileUpload} 
           disabled={isUploading} 
         /> 
         <input 
           id="glucose-upload-camera" 
           type="file" 
           accept="image/*" 
           capture="environment"
           className="hidden" 
           onChange={handleFileUpload} 
           disabled={isUploading} 
         /> 
         <div className="flex w-full gap-2">
           <label  
             htmlFor="glucose-upload" 
             className={cn("w-full flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-2xl border-2 border-dashed border-theme-accent/30 bg-theme-accent/5 hover:bg-theme-accent/10 hover:border-theme-accent/50 transition-colors text-theme-accent cursor-pointer", isUploading && "opacity-50 cursor-not-allowed")} 
           > 
             {isUploading ? <Loader2 className="animate-spin text-theme-accent" size={24} /> : <UploadCloud size={24} />} 
             <span className="font-bold text-sm text-center">{isUploading ? "Analyzing..." : "Upload Reading"}</span> 
           </label> 
           <label  
             htmlFor="glucose-upload-camera" 
             className={cn("w-full flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-2xl border-2 border-dashed border-theme-accent/30 bg-theme-accent/5 hover:bg-theme-accent/10 hover:border-theme-accent/50 transition-colors text-theme-accent cursor-pointer", isUploading && "opacity-50 cursor-not-allowed")} 
           > 
             {isUploading ? <Loader2 className="animate-spin text-theme-accent" size={24} /> : <Camera size={24} />} 
             <span className="font-bold text-sm text-center">{isUploading ? "Analyzing..." : "Take Photo"}</span> 
           </label> 
         </div>
       </div> 
       
       <div className="flex items-center gap-4 mb-4"> 
         <div className="h-px bg-theme-border flex-1"></div> 
         <span className="text-xs font-bold text-theme-text-sec ">or manual entry</span> 
         <div className="h-px bg-theme-border flex-1"></div> 
       </div> 
       
       <form onSubmit={handleManualSubmit} className="space-y-4"> 
         <div> 
           <label className="block text-sm font-bold text-theme-text mb-2">Blood Glucose (mg/dL)</label> 
           <input 
            type="number" min="0" max="1000"
            value={val} onChange={e => { setVal(e.target.value); if(source !== 'Manual') setSource('Manual'); }}
             autoFocus required
             className="w-full text-2xl px-4 py-3 bg-theme-bg border border-theme-border rounded-2xl focus:ring-2 focus:ring-theme-accent focus:border-theme-accent outline-none transition-all font-black text-center tracking-tight"
             placeholder="0"
           />
         </div>
         
         <div className="bg-theme-bg border border-theme-border p-4 rounded-xl">
           <label className="block text-sm font-bold text-theme-text mb-3 leading-tight">How many hours after eating did you perform this test?</label>
           <div className="flex items-center gap-3">
             <input 
               type="number" step="0.1" min="0" required
               value={hoursAgo} onChange={e => setHoursAgo(e.target.value)}
               placeholder="e.g. 2.5"
               className="w-24 px-4 py-3 bg-theme-card border border-theme-border rounded-xl focus:ring-2 focus:ring-theme-accent outline-none font-bold text-center"
             />
             <span className="text-theme-text-sec font-medium">hours ago</span>
           </div>
         </div>
         
         <div className="flex gap-3 pt-2">
           <button type="button" onClick={onClose} className="flex-1 py-3 px-4 bg-theme-card-sec border border-theme-border text-theme-text rounded-xl font-bold hover:bg-theme-border transition-colors">Cancel</button>
           <button type="submit" disabled={!val} className="flex-1 py-3 px-4 bg-gradient-to-r from-theme-accent to-theme-accent/80 text-white rounded-xl font-bold hover:opacity-90 transition-colors shadow-lg shadow-theme-accent/20 disabled:opacity-50">Save</button>
         </div>
       </form>
     </div>
   </div>
 </div>
 );
}

const CustomTooltip = ({ active, payload, label, chartColor, unit }: any) => {
 if (active && payload && payload.length) {
 const data = payload[0].payload;
 return (
 <div className="bg-theme-card/90 backdrop-blur-md border border-theme-border p-3 rounded-2xl shadow-xl min-w-[120px]">
 <p className="text-xs font-bold text-theme-text-sec mb-1">{safeFormat(data.date, 'MMM d, yyyy')}</p>
 <div className="flex items-baseline gap-1.5">
 <span className="text-2xl font-black tracking-tight" style={{ color: chartColor }}>{data.value}</span>
 <span className="text-xs font-bold text-theme-text-sec">{unit}</span>
 </div>
 {data.time && <p className="text-[10px] text-theme-text-sec mt-1 font-bold ">{data.time}</p>}
 </div>
 );
 }
 return null;
};

const CustomDot = (props: any) => {
 const { cx, cy, payload, value, chartColor, idealRange, timeFilter } = props;
 
 if (value === null || value === undefined) return null;

 const isNormal = idealRange && value >= idealRange.min && value <= idealRange.max;
 const isOutside = idealRange && (value < idealRange.min || value > idealRange.max);
 const showStatus = timeFilter <= 90;

 return (
 <svg x={cx - 10} y={cy - 10} width={20} height={20} className="overflow-visible">
 <circle cx={10} cy={10} r={4} fill="var(--color-theme-card)" stroke={chartColor} strokeWidth={2} />
 
 {showStatus && isNormal && (
 <svg x={12} y={-4} width={14} height={14} viewBox="0 0 24 24">
 <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="#3A7D44"/>
 </svg>
 )}
 {showStatus && isOutside && (
 <text x={10} y={0} dy={2} dx={8} textAnchor="middle" fontSize={12}>
 ⚠️
 </text>
 )}
 </svg>
 );
};

