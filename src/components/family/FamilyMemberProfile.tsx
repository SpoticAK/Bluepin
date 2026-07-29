import { auth } from '../../lib/firebase';
import { ActivityCircle, emojiToStatus } from '../ActivityCircle';
import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { FamilyMember } from './FamilyData';
import { User, ChevronLeft, FileText, Target, Scale, Activity, Download, ArrowUp, ArrowDown, ArrowUpRight, ChevronDown, ChevronUp, Info, ChevronRight, X, Check, AlertCircle, Flame, Heart, Droplet, Hexagon , Sparkles, Loader2, Triangle } from 'lucide-react';
import { cn, safeFormat, downloadFile } from '../../lib/utils';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { useAppStore } from '../../store';
import { parseISO, isAfter, subDays, startOfWeek, startOfMonth, format, isBefore, isWithinInterval, isSameDay, startOfDay , subMonths } from 'date-fns';
import { getCoreBiomarkersByCategory, TIER_1, isCoreBiomarkerPresent, calculateStatus, hydrateBiomarker, CATEGORIES } from '../../lib/biomarkerUtils';
import { calculateGoalsStreak, getActiveGoalsForDate } from '../../lib/goalUtils';
import { getSugarInsights, getDashboardMetrics, getHydratedBiomarkers, getMissedBiomarkers } from '../../lib/derivedMetrics';

import { CustomFlameEmoji } from '../CustomEmojis';
import { DashboardHealthDial } from '../DashboardHealthDial';


type AiInsights = {
 good: { profile: string; text: string }[];
 concern: { profile: string; text: string }[];
 advice: string[];
};

const PROFILE_LOGOS: Record<string, string> = {
 'Liver': '/logos/liver.png',
 'Lipid': '/logos/lipid.png',
 'Thyroid': '/logos/thyroid.png',
 'Kidney': '/logos/kidney.png',
 'Blood': '/logos/blood.png',
 'Glucose': '/logos/glucose.png',
 'Vitamins': '/logos/vitamins.png',
 'Urinary': '/logos/urinary.png',
 'Inflammatory': '/logos/inflammatory.png',
 'Others': '/logos/others.png',
};

const ProfileLogo = ({ profile }: { profile: string }) => {
 let matchedKey = 'Others';
 if (profile) {
 const lowerProfile = profile.toLowerCase();
 for (const key of Object.keys(PROFILE_LOGOS)) {
 if (key !== 'Others' && lowerProfile.includes(key.toLowerCase())) {
 matchedKey = key;
 break;
 }
 }
 }

 const src = PROFILE_LOGOS[matchedKey];
 
 return (
 <img 
 src={src} 
 alt={matchedKey} 
 className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0"
 title={profile || matchedKey}
 />
 );
};

const DynamicBubbles = () => (
 <div className="relative w-5 h-5 flex items-center justify-center mr-1">
 <div className="absolute w-2.5 h-2.5 bg-theme-success rounded-full opacity-60 animate-[ping_2s_ease-in-out_infinite]" />
 <div className="absolute w-3.5 h-3.5 bg-purple-500 rounded-full opacity-40 animate-[pulse_3s_ease-in-out_infinite]" style={{ transform: 'translate(5px, -5px)' }} />
 <div className="absolute w-2 h-2 bg-[#d97706] rounded-full opacity-80 animate-[bounce_2s_ease-in-out_infinite]" style={{ transform: 'translate(-6px, 4px)' }} />
 </div>
);

interface Props {
 member: FamilyMember;
 onBack: () => void;
}

export default function FamilyMemberProfile({ member, onBack }: Props) {
 
 const [selectedFitnessDate, setSelectedFitnessDate] = useState<string>(safeFormat(new Date(), 'yyyy-MM-dd'));
 const [showAllLogs, setShowAllLogs] = useState(false);
 const [showSugarHealth, setShowSugarHealth] = useState(false);
 const sugarInsights = useMemo(() => getSugarInsights(member.glucoseHistory || [], true), [member.glucoseHistory]);
 const [showBmiInfo, setShowBmiInfo] = useState(false);
 const [streakOffset, setStreakOffset] = useState(0);
 const renderStatusCircle = (emojiStr: string, isSelected: boolean) => {
    return <ActivityCircle status={emojiToStatus(emojiStr)} isSelected={isSelected} size="lg" />;
  };


 

 const { currentStreak, highestStreak, streakDays, canGoBack, canGoForward } = useMemo(() => {
    return calculateGoalsStreak(member.goals || [], member.goalLogs || {}, streakOffset);
 }, [member.goals, member.goalLogs, streakOffset]);

 
 const displayedGoals = useMemo(() => {
    const isToday = isSameDay(parseISO(selectedFitnessDate), new Date());
    
    const logs = (member.goalLogs || {})[selectedFitnessDate] || {};
    
    const activeForDate = getActiveGoalsForDate(member.goals || [], selectedFitnessDate);
    
    return activeForDate.map((g, i) => ({
      ...g,
      completed: logs[g.id] ? logs[g.id].completed : false,
      updatedAt: logs[g.id]?.completed ? `10:${15 + i * 5} AM` : undefined
    }));
 }, [member.goals, selectedFitnessDate, member.goalLogs]);

 const allGoalsCompleted = displayedGoals.length > 0 && displayedGoals.every(g => g.completed);
 const someGoalsCompleted = displayedGoals.some(g => g.completed);
 const showGoalsReadyToGo = !someGoalsCompleted && !allGoalsCompleted;

 
 


 const [activeTab, setActiveTab] = useState<'health' | 'glucose' | 'fitness'>('health');
 const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
 const [isAiInsightsCollapsed, setIsAiInsightsCollapsed] = useState(false);
 const [isAnalyzing, setIsAnalyzing] = useState(false);
 const [aiError, setAiError] = useState<string|null>(null);


 const generateInsights = async () => {
 const sortedReports = [...(member.labReports || [])].sort((a,b) => { try { return parseISO(a.date).getTime() - parseISO(b.date).getTime(); } catch { return 0; } });
 if (sortedReports.length === 0) return;
 
 setIsAnalyzing(true);
 setAiError(null);
 try {
 const sixMonthsAgo = subMonths(new Date(), 6);
 
 let relevantReports = sortedReports.filter(r => isAfter(parseISO(r.date), sixMonthsAgo));
 
 if (relevantReports.length < 3 && sortedReports.length >= 3) {
 relevantReports = sortedReports.slice(-3);
 } else if (sortedReports.length < 3) {
 relevantReports = sortedReports;
 }

 // Simplify reports to save tokens
 const simplifiedReports = relevantReports.map(r => ({
 date: r.date,
 biomarkers: r.biomarkers.map(b => ({
 name: b.name,
 value: b.value,
 unit: b.unit,
 status: b.status
 }))
 }));

 const res = await fetch('/api/generate-insights', {
 method: 'POST',
 headers: { 'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`, 'Content-Type': 'application/json' },
 body: JSON.stringify({ reports: simplifiedReports })
 });
 
 if (!res.ok) {
 const text = await res.text();
 let parsed;
 try { parsed = JSON.parse(text); } catch (e) {}
 throw new Error(parsed?.error || text || `HTTP Error ${res.status}`);
 }
 
 const data = await res.json();
 setAiInsights(data);
 } catch (err: any) {
 console.error(err);
 setAiError(err.message || "Failed to generate AI highlights.");
 } finally {
 setIsAnalyzing(false);
 }
 };



 const [healthSubTab, setHealthSubTab] = useState<'dashboard' | 'timeline'>('dashboard');
 const [isCompletenessPanelOpen, setIsCompletenessPanelOpen] = useState(false);
 const [glucoseFilter, setGlucoseFilter] = useState<'Fasting' | 'Random' | 'Post-prandial' | 'HbA1c'>('Fasting');
 const [glucoseTimeFilter, setGlucoseTimeFilter] = useState<string>('30 Days');
 const [fitnessGraph, setFitnessGraph] = useState<'weight' | 'bmi'>('weight');
 const { labReports: appLabReports } = useAppStore();

 const CATEGORIES = ["Lipid Profile", "Liver Profile", "Renal Profile", "Thyroid Profile", "Hemogram", "Vitamins & Minerals", "Others"];

 
 const sortedReportsGlobal = useMemo(() => {
   return [...(member.labReports || [])].sort((a,b) => { try { return parseISO(a.date).getTime() - parseISO(b.date).getTime(); } catch { return 0; } });
 }, [member.labReports]);

 const allBiomarkersLatest = useMemo(() => {
   if (sortedReportsGlobal.length === 0) return [];
   const latestReport = sortedReportsGlobal[sortedReportsGlobal.length - 1];
   if (!latestReport.biomarkers) return [];
   return latestReport.biomarkers.map((bRaw: any) => {
     const b = hydrateBiomarker(bRaw);
     return {
       ...b,
       date: latestReport.date,
       ...calculateStatus(b.biomarkerId || b.name, b.value, b.refMin, b.refMax, b.status, b.refRangeText)
     };
   });
 }, [sortedReportsGlobal]);

 const hydratedBiomarkers = useMemo(() => getHydratedBiomarkers((member.labReports as any) || []), [member.labReports]);

 const { missingCoreCount, missingCoreCategorized, missedBiomarkers, missedBiomarkersCategorized } = useMemo(() => {
   const missed = getMissedBiomarkers((member.labReports as any) || []);
   
   if (allBiomarkersLatest.length === 0) return { missingCoreCount: 0, missingCoreCategorized: {}, missedBiomarkers: missed.missedBiomarkers, missedBiomarkersCategorized: missed.missedBiomarkersCategorized };
   
   const availableNames = allBiomarkersLatest.map(b => b.biomarkerId || b.name);
   const missing: Record<string, string[]> = {};
   let count = 0;
   
   Object.entries(getCoreBiomarkersByCategory()).forEach(([category, markers]) => {
     const missingInCategory = markers.filter(m => !isCoreBiomarkerPresent(m, availableNames));
     if (missingInCategory.length > 0) {
       missing[category] = missingInCategory;
       count += missingInCategory.length;
     }
   });
   
   return {
     missingCoreCount: count,
     missingCoreCategorized: missing,
     missedBiomarkers: missed.missedBiomarkers,
     missedBiomarkersCategorized: missed.missedBiomarkersCategorized
   };
 }, [allBiomarkersLatest, member.labReports]);

 // Graph Modal State
 const [selectedBiomarker, setSelectedBiomarker] = useState<{ biomarker: any, history: any[] } | null>(null);

 const getHistoryForBiomarker = (biomarkerName: string) => {
 let sortedReports = [...(member.labReports || [])].sort((a,b) => { try { return parseISO(a.date).getTime() - parseISO(b.date).getTime(); } catch { return 0; } });
 
 let history = sortedReports.map(r => {
 if (!r.biomarkers) return null;
 const bRaw = r.biomarkers.find((x:any) => { const hydX = hydrateBiomarker(x); return (hydX.biomarkerId || hydX.name).toLowerCase().trim() === biomarkerName.toLowerCase().trim(); }); if (!bRaw) return null; const b = hydrateBiomarker(bRaw);
 if (!b) return null;
 return { 
 date: r.date, 
 value: b.value, 
 ...calculateStatus(b.biomarkerId || b.name, b.value, b.refMin, b.refMax, b.status, b.refRangeText) 
 };
 }).filter(Boolean);
 
 if (history.length === 0) {
 const b = hydratedBiomarkers.find(x => (x.biomarkerId || x.name).toLowerCase().trim() === biomarkerName.toLowerCase().trim());
 if (b) {
 history = [{
 date: new Date().toISOString(),
 value: b.value,
 ...calculateStatus(b.biomarkerId || b.name, b.value, b.refMin, b.refMax, b.status, b.refRangeText)
 }];
 }
 }
 
 return history;
 };
 
 // Use actual uploaded lab reports for everyone, or just their dummy ones if no real ones exist
 const displayReports = member.labReports || [];

 // Derive counts
 const needsAttentionCount = allBiomarkersLatest.filter(b => b.status === 'Needs Attention').length;
 const borderlineCount = allBiomarkersLatest.filter(b => b.status === 'Borderline').length;
 const healthyCount = allBiomarkersLatest.length - (needsAttentionCount + borderlineCount);

 return (
 <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-24 max-w-4xl mx-auto">
 <button 
 onClick={onBack}
 className="flex items-center gap-2 text-theme-text-sec hover:text-theme-text transition-colors group"
 >
 <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
 <span className="font-medium">Back to Family</span>
 </button>

 {/* Profile Header */}
 <div className="flex flex-row items-center gap-5 sm:gap-6 mb-8">
 {member.photoUrl ? (
 <img src={member.photoUrl} alt={member.name} className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-theme-card shadow-sm object-cover" />
 ) : (
 <div 
 className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-white/10 dark:border-white/5 flex items-center justify-center shrink-0 relative overflow-hidden"
 style={{ 
 background: `linear-gradient(135deg, ${member.avatarColor}99 0%, ${member.avatarColor} 100%)`,
 boxShadow: `0 8px 30px -8px ${member.avatarColor}70`
 }}
 >
 <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
 <span className="font-display font-medium text-3xl sm:text-4xl text-white/90 relative z-10 ">{member.name.charAt(0)}</span>
 </div>
 )}
 <div>
 <h2 className="text-2xl sm:text-3xl font-display font-medium text-theme-text tracking-tight">{member.name}'s Profile</h2>
 <p className="text-theme-text-sec text-xs sm:text-sm mt-1 font-bold">Health Dashboard</p>
 </div>
 </div>

 {/* Primary Navigation */}
 <div className="flex flex-wrap gap-2 pb-2 border-b border-theme-border">
 {(['health', 'glucose', 'fitness'] as const).map(tab => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 className={cn(
 "flex-1 sm:flex-none justify-center px-3 sm:px-5 py-2.5 text-xs sm:text-sm font-bold capitalize transition-all whitespace-nowrap rounded-2xl flex items-center gap-2",
 activeTab === tab ? "bg-gradient-to-r from-[#C85A17] to-[#DF6D22] text-white shadow-sm" : "text-theme-text-sec hover:bg-theme-card border border-transparent hover:border-theme-border"
 )}
 >
 {tab === 'health' && <Heart size={16} className="text-rose-500" />}
 {tab === 'glucose' && <Droplet size={16} className="text-rose-500" />}
 {tab === 'fitness' && <Flame size={16} className="text-orange-500" />}
 {tab}
 </button>
 ))}
 </div>

 {/* Health Section */}
 {activeTab === 'health' && (
 <div className="space-y-6 animate-in fade-in">
 {/* Health Sub-tabs & Actions */}
 <div className="flex flex-row flex-nowrap items-center justify-between gap-2 sm:gap-4 mb-2 w-full overflow-hidden">
                <div className="flex bg-theme-card p-0.5 sm:p-1 rounded-full border border-theme-border border-dashedrelative flex-1 sm:flex-none">
                  <button
                    onClick={() => setHealthSubTab('dashboard')}
                    className={cn(
                      "flex-1 sm:flex-none px-3 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-colors relative z-10",

 healthSubTab === 'dashboard' ? "text-white" : "text-theme-text-sec hover:text-theme-text"
 )}
 >
 {healthSubTab === 'dashboard' && (
 <motion.div
 layoutId="healthSubTab-active"
 className="absolute inset-0 bg-gradient-to-r from-[#C85A17] to-[#DF6D22] rounded-full shadow-md -z-10"
 transition={{ type: "spring", stiffness: 300, damping: 25 }}
 />
 )}
 Dashboard
                  </button>
                  <button
                    onClick={() => setHealthSubTab('timeline')}
                    className={cn(
                      "flex-1 sm:flex-none px-3 sm:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-colors relative z-10",

 healthSubTab === 'timeline' ? "text-white" : "text-theme-text-sec hover:text-theme-text"
 )}
 >
 {healthSubTab === 'timeline' && (
 <motion.div
 layoutId="healthSubTab-active"
 className="absolute inset-0 bg-gradient-to-r from-[#C85A17] to-[#DF6D22] rounded-full shadow-md -z-10"
 transition={{ type: "spring", stiffness: 300, damping: 25 }}
 />
 )}
 Timeline
                  </button>
                </div>

                <button 
                  onClick={generateInsights}
                  disabled={isAnalyzing}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full text-white bg-gradient-to-r from-[#9B49FC] to-[#792DF5] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg shrink-0"
                >
 {isAnalyzing ? (
 <Loader2 size={16} className="animate-spin" />
 ) : (
 <Triangle size={16} className="shrink-0 animate-[spin_4s_linear_infinite]" />
 )}
 {isAnalyzing ? "Generating..." : "Highlights"}
 </button>
 </div>
 
 {healthSubTab === 'dashboard' ? (
 <div className="space-y-8 animate-in fade-in">
 {/* Health Score & Biomarker Summary */}
 {(() => {
 const getScoreDetails = (s: number) => {
 if (s >= 90) return { label: 'Excellent', color: 'var(--color-theme-success)', glow: 'rgba(0, 255, 163, 0.5)' };
 if (s >= 75) return { label: 'Good', color: 'var(--color-theme-success)', glow: 'rgba(74, 222, 128, 0.5)' };
 if (s >= 60) return { label: 'Fair', color: 'var(--color-theme-warning)', glow: 'rgba(250, 204, 21, 0.5)' };
 if (s >= 40) return { label: 'Unhealthy', color: 'var(--color-theme-warning)', glow: 'rgba(251, 146, 60, 0.5)' };
 return { label: 'Alarming', color: 'var(--color-theme-critical)', glow: 'rgba(248, 113, 113, 0.5)' };
 };
 
 const score = member.healthScore;
 const prevScore = member.prevHealthScore ?? null;
 const details = getScoreDetails(score);
 const optimalCount = healthyCount;
 const isComplete = missedBiomarkers.length === 0 && missingCoreCount === 0;
 
 return (
 <div className="bg-theme-card rounded-[32px] border border-theme-border border-dashedp-6 sm:p-10 mb-8 flex flex-col lg:flex-row items-center justify-between gap-8 sm:gap-12 relative overflow-hidden shadow-sm">
 {/* Left Column: Circular Progress & Score */}
 <div className="flex flex-col items-center shrink-0 w-full lg:w-auto">
                      <DashboardHealthDial score={score} scoreDiff={prevScore !== null ? score - prevScore : 0} />
                    </div>

                    {/* Right Column: Score Label, Changes, Details */}
 <div className="flex-1 min-w-0 w-full space-y-6">
 <div>
 <div className="flex flex-col items-center sm:items-start mb-2">
 <h2 className="text-5xl sm:text-6xl font-display font-medium text-theme-text">{details.label}</h2>
 </div>
 <p className="text-theme-text font-sans text-sm max-w-md text-center sm:text-left mx-auto sm:mx-0">Based on your latest lab results compared to optimal clinical ranges.</p>
 </div>

 <div className="flex items-center justify-center sm:justify-start gap-6 sm:gap-8 w-full animate-in fade-in slide-in-from-bottom-2 duration-700 mt-2">
      {/* Optimal */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-3 h-3 rounded-full bg-emerald-500/20 dark:bg-emerald-400/20 blur-[2px]" />
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 relative z-10" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-theme-text font-display font-medium text-[15px] leading-none">{optimalCount}</span>
          <span className="text-theme-text-sec font-sans text-[12px] font-medium">Optimal</span>
        </div>
      </div>
      
      {/* Borderline */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-3 h-3 rounded-full bg-amber-500/20 dark:bg-amber-400/20 blur-[2px]" />
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 relative z-10" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-theme-text font-display font-medium text-[15px] leading-none">{borderlineCount}</span>
          <span className="text-theme-text-sec font-sans text-[12px] font-medium">Borderline</span>
        </div>
      </div>

      {/* Attention */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-3 h-3 rounded-full bg-red-500/20 dark:bg-red-400/20 blur-[2px]" />
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 dark:bg-red-400 relative z-10" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-theme-text font-display font-medium text-[15px] leading-none">{needsAttentionCount}</span>
          <span className="text-theme-text-sec font-sans text-[12px] font-medium">Attention</span>
        </div>
      </div>
    </div>

                      {!isComplete && (
 <div className="flex justify-center sm:justify-start mt-2">
 <button 
 onClick={() => setIsCompletenessPanelOpen(true)}
 className="group inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-theme-card-sec/50 hover:bg-theme-card-sec/80 border border-theme-border border-dashed/50 backdrop-blur-md shadow-sm transition-all text-sm font-sans text-theme-text"
 >
 <AlertCircle size={16} className="text-amber-500" />
 <span className="font-medium">Incomplete</span>
 <ChevronRight size={16} className="text-theme-text-sec group-hover:translate-x-0.5 transition-transform" />
 </button>
 </div>
 )}
 </div>
 </div>
 );
 })()}

 {/* Section 2: Highlights */}
 <div id="highlights" className="scroll-mt-8">
 

 {aiError && (
 <div className="mb-4 p-4 rounded-2xl bg-theme-critical/10 border border-theme-critical/20 text-theme-critical text-sm">
 {aiError}
 </div>
 )}

 {aiInsights && (
 <div className="mb-6 p-6 sm:p-8 rounded-[32px] bg-gradient-to-br from-theme-card to-purple-500/5 border border-purple-500/20 shadow-md relative overflow-hidden group">
 <div className="absolute top-0 right-0 p-8 opacity-5">
 <Sparkles size={120} className="text-purple-500" />
 </div>
 <div className="relative z-10">
 <div className="flex items-center justify-between mb-4 cursor-pointer select-none group/title" onClick={() => setIsAiInsightsCollapsed(!isAiInsightsCollapsed)}>
 <h4 className="text-lg font-display font-medium text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center gap-2">
 <DynamicBubbles />
 Highlights
 </h4>
 <button className="text-purple-600/70 hover:text-purple-600 transition-colors p-2 -mr-2 bg-purple-500/10 rounded-full group-hover/title:bg-purple-500/20">
 <ChevronRight size={20} className={cn("transition-transform duration-300", !isAiInsightsCollapsed && "rotate-90")} />
 </button>
 </div>

 {!isAiInsightsCollapsed && (
 <div className="space-y-6 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
 {aiInsights.good && aiInsights.good.length > 0 && (
 <div>
 <h5 className="font-bold text-theme-success mb-2 text-sm flex items-center gap-2">
 <ArrowUp size={16} /> Good Progress
 </h5>
 <ul className="space-y-2.5">
 {aiInsights.good.map((insight, i) => (
 <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-theme-text-sec">
 <ProfileLogo profile={insight.profile} />
 <span className="leading-relaxed">{typeof insight === "object" ? (insight.text || JSON.stringify(insight)) : String(insight)}</span>
 </li>
 ))}
 </ul>
 </div>
 )}

 {aiInsights.concern && aiInsights.concern.length > 0 && (
 <div>
 <h5 className="font-bold text-[#d97706] dark:text-[#f59e0b] mb-2 text-sm flex items-center gap-2">
 <ArrowDown size={16} /> Areas of Concern
 </h5>
 <ul className="space-y-2.5">
 {aiInsights.concern.map((insight, i) => (
 <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-theme-text-sec">
 <ProfileLogo profile={insight.profile} />
 <span className="leading-relaxed">{typeof insight === "object" ? (insight.text || JSON.stringify(insight)) : String(insight)}</span>
 </li>
 ))}
 </ul>
 </div>
 )}

 {aiInsights.advice && aiInsights.advice.length > 0 && (
 <div className="bg-purple-500/5 p-4 sm:p-5 rounded-2xl border border-purple-500/20">
 <h5 className="font-bold text-purple-700 dark:text-purple-400 mb-2 text-sm flex items-center gap-2">
 <Sparkles size={16} /> Quick Advice
 </h5>
 <ul className="space-y-2.5">
 {aiInsights.advice.map((insight, i) => (
 <li key={i} className="flex items-start gap-3 text-sm text-purple-900/80 dark:text-purple-200/80">
 <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-purple-500/60" />
 <span className="leading-relaxed">{typeof insight === "object" ? (insight.text || JSON.stringify(insight)) : String(insight)}</span>
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 )}
 </div>

 

 {/* Full Lab Report (Grouped) */}
 <div className="space-y-4 pt-4">
 
 <div className="px-1 mb-2">
 {member.labReports && member.labReports.length > 0 && (() => {
 const sorted = [...member.labReports].sort((a,b) => { 
 try { 
 const timeA = new Date(a.date).getTime();
 const timeB = new Date(b.date).getTime();
 return timeA - timeB; 
 } catch { 
 return 0; 
 } 
 });
 const latest = sorted[sorted.length - 1];
 return (
 <p className="text-sm text-theme-text-sec mb-2 font-medium">
 From {latest.name || 'Lab Report'} ({safeFormat(latest.date, 'dd MMM yyyy')})
 </p>
 );
 })()}
 <h3 className="text-lg font-bold text-theme-text">All Parameters</h3>
 </div>
 {Array.from(new Set([...CATEGORIES, ...allBiomarkersLatest.map(b => b.category)])).map(category => {
 const catMarkers = allBiomarkersLatest.filter(b => b.category === category);
 if (catMarkers.length === 0) return null;
 return (
 <FamilyCategoryGroup 
 key={category} 
 category={category} 
 biomarkers={catMarkers} 
 getHistory={getHistoryForBiomarker}
 onSelectBiomarker={(b, h) => setSelectedBiomarker({ biomarker: b, history: h })}
 />
 );
 })}
 </div>
 </div>
 ) : (
 <div className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-3xl border border-theme-border border-dashedp-6 sm:p-8 animate-in fade-in shadow-sm">
 <h3 className="text-xl font-bold text-theme-text mb-8">Historical Timeline</h3>
 <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-theme-border before:to-transparent">
 {displayReports.length === 0 ? (
 <p className="text-theme-text-sec text-center py-8">No medical reports found.</p>
 ) : (
 [...displayReports].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((report, i) => (
 <div key={report.id || i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active py-6">
 <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-theme-card bg-theme-bg text-theme-text-sec shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 group-hover:text-theme-text group-hover:border-theme-border transition-colors relative z-10">
 <FileText size={16} />
 </div>
 
 <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] bg-theme-bg border border-theme-border border-dashedp-4 rounded-2xl shadow-sm hover:shadow-md transition-all group-hover:-translate-y-1">
 <div className="flex justify-between items-start mb-2">
 <div>
 <p className="text-xs font-bold text-theme-text-sec mb-1">{report.date}</p>
 <h4 className="font-bold text-theme-text leading-tight">{report.name}</h4>
 </div>
 {report.score && (
 <div className="bg-theme-card px-2 py-1 rounded-lg border border-theme-border border-dashedtext-xs font-bold">
 Score: {report.score}
 </div>
 )}
 </div>
 <button 
 onClick={() => { if(report.fileUrl && report.fileUrl !== '#') downloadFile(report.fileUrl, report.date) }}
 className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-theme-card hover:bg-theme-text/5 border border-theme-border border-dashedrounded-xl text-sm font-bold transition-colors"
 >
 <Download size={14} /> Download PDF
 </button>
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Glucose Section */}
 {activeTab === 'glucose' && (
 <div className="space-y-6 animate-in fade-in">
 {!member.glucoseEnabled ? (
 <div className="bg-theme-card rounded-3xl border border-theme-border border-dashedp-12 text-center">
 <div className="w-16 h-16 bg-theme-bg rounded-full flex items-center justify-center mx-auto mb-4 border border-theme-border border-dashed">
 <Activity size={24} className="text-theme-text-sec" />
 </div>
 <p className="text-lg font-bold text-theme-text">Glucose Tracking Not Enabled</p>
 <p className="text-theme-text-sec mt-2">This member is not actively tracking glucose.</p>
 </div>
 ) : (
 <>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
 <div className="bg-theme-card rounded-[32px] p-6 sm:p-8 border border-theme-border border-dashedshadow-lg relative overflow-hidden group">
 <div className="absolute top-0 right-0 p-8 opacity-5">
 <Droplet size={100} fill="currentColor" />
 </div>
 <div className="relative z-10 flex flex-col h-full justify-between gap-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs font-bold text-theme-text-sec mb-1">Latest Reading</p>
 <h3 className="text-2xl font-display font-medium text-theme-text font-sans">Blood Glucose</h3>
 </div>
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-theme-accent/20 to-theme-accent/5 border border-theme-accent/20 flex items-center justify-center">
 <Droplet className="text-theme-accent" size={24} fill="currentColor" fillOpacity={0.2} />
 </div>
 </div>
 <div className="flex flex-col xl:flex-row xl:items-center justify-between border-t border-theme-border/50 pt-5 gap-4">
 <div className="flex items-baseline gap-2">
 <span className="text-5xl font-black tracking-tighter text-theme-text">{member.latestGlucose}</span>
 <span className="text-sm font-bold text-theme-text-sec">{member.glucoseUnit}</span>
 </div>
 <div className="flex flex-row xl:flex-col items-center xl:items-end gap-3 xl:gap-2 flex-wrap">
 <div className="flex items-center gap-1.5 bg-theme-bg px-2.5 py-1 rounded-full border border-theme-border border-dashed/50">
 <div className={cn(
 "w-2 h-2 rounded-full shrink-0",
 member.latestGlucoseType === 'Fasting' ? "bg-green-500" :
 member.latestGlucoseType === 'Random' ? "bg-blue-500" :
 member.latestGlucoseType === 'Post-prandial' ? "bg-red-500" : "bg-theme-accent"
 )} />
 <span className="text-[10px] font-bold text-theme-text">
 {member.latestGlucoseType || 'Unknown'}
 </span>
 </div>
 </div>
 </div>
 </div>
 </div>
 
 <div className="bg-theme-card rounded-[32px] p-6 sm:p-8 border border-theme-border border-dashedshadow-lg relative overflow-hidden group">
 <div className="absolute top-0 right-0 p-8 opacity-5">
 <Hexagon size={100} fill="currentColor" />
 </div>
 <div className="relative z-10 flex flex-col h-full justify-between gap-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs font-bold text-theme-text-sec mb-1">Laboratory</p>
 <h3 className="text-2xl font-display font-medium text-theme-text font-sans">HbA1c</h3>
 </div>
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/20 flex items-center justify-center">
 <Hexagon className="text-purple-500" size={24} fill="currentColor" fillOpacity={0.2} />
 </div>
 </div>
 <div className="flex flex-col xl:flex-row xl:items-center justify-between border-t border-theme-border/50 pt-5 gap-4">
 <div className="flex items-baseline gap-2">
 <span className="text-5xl font-black tracking-tighter text-theme-text">{member.hba1c || '--'}</span>
 <span className="text-sm font-bold text-theme-text-sec">%</span>
 </div>
 </div>
 </div>
 </div>
</div>

 <div className="bg-theme-card rounded-3xl border border-theme-border border-dashedp-6 sm:p-8">
 <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
 <div className="flex flex-col gap-2 w-full xl:w-auto">
 <h3 className="text-xl font-bold text-theme-text">Glucose Trend</h3>
 <div className="flex bg-theme-bg p-1 rounded-2xl border border-theme-border border-dashedw-full sm:w-auto overflow-x-auto custom-scrollbar">
 {(glucoseFilter === 'HbA1c' ? ['90 Days', '180 Days', 'Lifetime'] : ['7 Days', '15 Days', '30 Days', '90 Days', '1 Year']).map((tf) => (
 <button
 key={tf}
 onClick={() => setGlucoseTimeFilter(tf)}
 className={cn(
 "px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap",
 glucoseTimeFilter === tf 
 ? "bg-theme-card text-theme-text shadow-sm" 
 : "text-theme-text-sec hover:text-theme-text"
 )}
 >
 {tf}
 </button>
 ))}
 </div>
 </div>
 <div className="flex bg-theme-bg p-1 rounded-2xl border border-theme-border border-dashedw-full xl:w-auto overflow-x-auto custom-scrollbar">
 {(['Fasting', 'Random', 'Post-prandial', 'HbA1c'] as const).map((type) => (
 <button
 key={type}
 onClick={() => {
 setGlucoseFilter(type);
 if (type === 'HbA1c' && !['90 Days', '180 Days', 'Lifetime'].includes(glucoseTimeFilter)) {
 setGlucoseTimeFilter('90 Days');
 } else if (type !== 'HbA1c' && !['7 Days', '15 Days', '30 Days', '90 Days', '1 Year'].includes(glucoseTimeFilter)) {
 setGlucoseTimeFilter('30 Days');
 }
 }}
 className={cn(
 "px-3 sm:px-4 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap",
 glucoseFilter === type 
 ? "bg-theme-card text-theme-text shadow-sm" 
 : "text-theme-text-sec hover:text-theme-text"
 )}
 >
 {type}
 </button>
 ))}
 </div>
 </div>
 <div className="h-64 w-full">
 {(() => {
 let filteredGlucoseData = member.glucoseHistory.filter(h => h.type === glucoseFilter);
 const now = new Date();
 
 let cutoffDate = now;
 let grouping = 'none';
 
 if (glucoseFilter !== 'HbA1c') {
 if (glucoseTimeFilter === '7 Days') { cutoffDate = subDays(now, 7); }
 else if (glucoseTimeFilter === '15 Days') { cutoffDate = subDays(now, 15); }
 else if (glucoseTimeFilter === '30 Days') { cutoffDate = subDays(now, 30); }
 else if (glucoseTimeFilter === '90 Days') { cutoffDate = subDays(now, 90); grouping = 'week'; }
 else if (glucoseTimeFilter === '1 Year') { cutoffDate = subDays(now, 365); grouping = 'month'; }
 } else {
 if (glucoseTimeFilter === '90 Days') { cutoffDate = subDays(now, 90); }
 else if (glucoseTimeFilter === '180 Days') { cutoffDate = subDays(now, 180); }
 else if (glucoseTimeFilter === 'Lifetime') { cutoffDate = new Date(0); grouping = 'month'; }
 }

 filteredGlucoseData = filteredGlucoseData.filter(d => !isBefore(parseISO(d.date), cutoffDate));
 
 if (grouping !== 'none') {
 const grouped = new Map<string, { sum: number; count: number }>();
 filteredGlucoseData.forEach(d => {
 const dateObj = parseISO(d.date);
 let keyDate;
 if (grouping === 'week') {
 keyDate = startOfWeek(dateObj);
 } else {
 keyDate = startOfMonth(dateObj);
 }
 const key = format(keyDate, 'yyyy-MM-dd');
 const existing = grouped.get(key) || { sum: 0, count: 0 };
 grouped.set(key, { sum: existing.sum + d.value, count: existing.count + 1 });
 });
 
 filteredGlucoseData = Array.from(grouped.entries())
 .sort((a, b) => a[0].localeCompare(b[0]))
 .map(([key, data]) => ({
 date: format(parseISO(key), grouping === 'week' ? 'MMM d' : 'MMM yyyy'),
 value: Number((data.sum / data.count).toFixed(1)),
 type: glucoseFilter as any
 }));
 } else {
 filteredGlucoseData = filteredGlucoseData
 .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
 .map(d => ({ ...d, date: format(parseISO(d.date), 'MMM d') }));
 }

 if (filteredGlucoseData.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center h-full text-theme-text-sec">
 <Activity size={32} className="mb-2 opacity-30" />
 <p>No readings</p>
 </div>
 );
 }
 const getNormalRange = (type: string) => {
 switch(type) {
 case 'Fasting': return [70, 99];
 case 'Post-prandial': return [70, 140];
 case 'Random': return [70, 140];
 case 'HbA1c': return [4.0, 5.7];
 default: return [0, 100];
 }
 };
 const normalRange = getNormalRange(glucoseFilter);



 return (
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={filteredGlucoseData}>
 <CartesianGrid strokeDasharray="3 3" stroke="var(--color-theme-border)" vertical={false} />
 <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'var(--color-theme-text-sec)'}} dy={10} minTickGap={20} />
 <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'var(--color-theme-text-sec)'}} dx={-10} domain={['dataMin - 10', 'dataMax + 10']} />
 <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', backgroundColor: 'var(--color-theme-card)', color: 'var(--color-theme-text)' }} />
 <ReferenceArea y1={normalRange[0]} y2={normalRange[1]} {...({ fill: "#22c55e", fillOpacity: 0.15, stroke: "none", ifOverflow: "extendDomain" } as any)} />
 <ReferenceLine y={normalRange[1]} stroke="#22c55e" strokeWidth={2} strokeDasharray="4 4" opacity={0.8} ifOverflow="extendDomain" />
 <ReferenceLine y={normalRange[0]} stroke="#22c55e" strokeWidth={2} strokeDasharray="4 4" opacity={0.8} ifOverflow="extendDomain" />
 <Line type="monotone" dataKey="value" stroke="var(--color-theme-accent)" strokeWidth={3} dot={{r: 4, fill: "var(--color-theme-card)", stroke: "var(--color-theme-accent)", strokeWidth: 2}} activeDot={{r:6, fill:"var(--color-theme-accent)", strokeWidth:2, stroke:"var(--color-theme-card)"}} />
 </LineChart>
 </ResponsiveContainer>
 );
 })()}
 </div>
 </div>

 <button
 onClick={() => setShowSugarHealth(true)}
 className="w-full justify-center relative overflow-hidden flex items-center gap-2 text-sm font-bold bg-gradient-to-r from-purple-600 via-indigo-500 to-violet-600 text-white px-5 py-3 rounded-xl transition-all shadow-lg shadow-purple-500/30 shrink-0 group hover:shadow-xl hover:-translate-y-0.5 my-2"
 >
 <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
 <Hexagon size={16} className="relative z-10 animate-[spin_4s_linear_infinite]" />
 <span className="relative z-10">Sugar Health</span>
 </button>

 {/* Glucose Logs History */}
 <div className="bg-theme-card rounded-[32px] border border-theme-border border-dashedp-6 sm:p-8">
 <h3 className="text-xl font-bold text-theme-text mb-6">Log History</h3>
 <div className="space-y-3">
 {member.glucoseHistory.filter(h => h.type !== 'HbA1c').length === 0 ? (
 <p className="text-theme-text-sec text-center py-4">No logs found.</p>
 ) : (
 <>
 {[...member.glucoseHistory]
 .filter(h => h.type !== 'HbA1c')
 .reverse()
 .slice(0, showAllLogs ? undefined : 5)
 .map((log, i) => (
 <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-theme-bg border border-theme-border border-dashed">
 <div>
 <p className="font-bold text-theme-text text-lg">{log.value} <span className="text-sm font-medium text-theme-text-sec">{member.glucoseUnit}</span></p>
 <p className="text-xs text-theme-text-sec mt-1">{log.date}</p>
 </div>
 <div className="flex items-center gap-1.5 bg-theme-bg px-2.5 py-1 rounded-full border border-theme-border border-dashed/50">
 <div className={cn(
 "w-2 h-2 rounded-full shrink-0",
 log.type === 'Fasting' ? "bg-green-500" :
 log.type === 'Random' ? "bg-blue-500" :
 log.type === 'Post-prandial' ? "bg-red-500" : "bg-theme-accent"
 )} />
 <span className="text-[10px] font-bold text-theme-text">
 {log.type || 'Unknown'}
 </span>
 </div>
 </div>
 ))}
 {member.glucoseHistory.filter(h => h.type !== 'HbA1c').length > 5 && (
 <button
 onClick={() => setShowAllLogs(!showAllLogs)}
 className="w-full py-3 mt-4 bg-theme-bg border border-theme-border border-dashedrounded-xl text-sm font-bold text-theme-text hover:bg-theme-card-sec transition-colors"
 >
 {showAllLogs ? "Show Less" : "See More"}
 </button>
 )}
 </>
 )}
 </div>
 </div>
 </>
 )}
 </div>
 )}

 {/* Fitness Section */}
 {activeTab === 'fitness' && (
 <div className="space-y-6 animate-in fade-in">
 {/* Current Streak */}
 <div className="flex items-center gap-3 w-full sm:w-auto">
 <div className="flex-1 sm:flex-none flex items-center justify-between sm:justify-start gap-4 bg-theme-card border-2 border-theme-accent/30 px-5 py-3 rounded-2xl shadow-[0_0_15px_rgba(232,122,93,0.1)] relative overflow-hidden">
 <div className="flex flex-col relative z-10">
 <p className="text-xs font-medium text-theme-text-sec font-sans leading-none mb-1.5">Current streak</p>
 <div className="flex items-center gap-2">
 <p className="text-3xl font-sans font-bold text-theme-text leading-none">{currentStreak}</p>
 {currentStreak > 0 && <Flame className="w-5 h-5 text-theme-accent animate-pulse" />}
 </div>
 </div>
 <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-theme-accent/5 to-transparent z-0 pointer-events-none"></div>
 </div>
 
 <div className="flex-1 sm:flex-none flex items-center justify-between sm:justify-start gap-5 bg-theme-card border border-theme-border border-dashed/60 px-5 py-3 rounded-2xl shadow-sm opacity-90">
 <div className="flex flex-col">
 <p className="text-xs font-medium text-theme-text-sec font-sans leading-none mb-1.5">Best streak</p>
 <p className="text-3xl font-sans font-bold text-theme-text leading-none">{highestStreak}</p>
 </div>
 </div>
 </div>

 <div className="bg-theme-card px-5 py-5 sm:px-6 rounded-[32px] border border-theme-border border-dashedshadow-sm overflow-x-auto scrollbar-hide">
 <div className="flex items-center gap-3 sm:gap-4 min-w-max w-full justify-between relative px-2">
 <div className="absolute top-[10px] sm:top-[14px] left-12 right-12 h-1 sm:h-1 bg-theme-border/50 rounded-full z-0" />
 
 {canGoBack && (
 <button onClick={() => setStreakOffset(prev => prev + 7)} className="z-10 p-1 text-theme-text-sec hover:text-theme-text bg-theme-bg rounded-full shadow-sm border border-theme-border border-dashed">
 <ChevronLeft size={16} />
 </button>
 )}
          {!canGoBack && <div className="w-[26px]"></div>}
        </div>
      </div>

      <div className="bg-theme-card border border-theme-border border-dashed p-4 sm:p-6 rounded-[32px] shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-theme-text-sec uppercase tracking-wider">Activity Trend</h3>
        </div>
        <div className="h-48 sm:h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={member.weightHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-theme-accent)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-theme-accent)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-theme-border)" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'var(--color-theme-text-sec)'}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'var(--color-theme-text-sec)'}} dx={-10} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', backgroundColor: 'var(--color-theme-card)', color: 'var(--color-theme-text)' }} />
              <Area type="monotone" dataKey={fitnessGraph} stroke="var(--color-theme-text)" strokeWidth={3} fillOpacity={1} fill="url(#colorMetric)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )}

  {isCompletenessPanelOpen && (
    <div className="fixed inset-0 z-[60] bg-theme-text/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-theme-card max-w-lg w-full rounded-3xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        <button 
          onClick={() => setIsCompletenessPanelOpen(false)}
          className="absolute top-6 right-6 text-theme-text-sec hover:text-theme-text"
        >
          <X size={20} />
        </button>
        <h3 className="text-xl font-bold text-theme-text mb-2 flex items-center gap-2">
          <AlertCircle size={20} className="text-amber-500" /> Incomplete Assessment
 </h3>
 <p className="text-sm text-theme-text-sec mb-6">
 This Health Score has been calculated using the biomarkers available in your uploaded report. Some commonly recommended biomarkers were not included in this laboratory test.
 </p>
 
 <div className="flex-1 overflow-y-auto mb-6 pr-2 space-y-6">
 {missingCoreCount > 0 && (
 <div>
 <span className="flex items-center gap-1.5 font-bold text-amber-500 mb-1 mt-2">
 <AlertCircle size={16} /> Incomplete Report:
 </span>
 <span className="block mb-2 text-theme-text-sec">The following essential biomarkers were not included:</span>
 <ul className="list-disc pl-5 space-y-1 text-theme-text-sec">
 {(Object.entries(missingCoreCategorized) as [string, string[]][]).map(([category, markers]) => (
 <li key={category}>
 <span className="font-semibold text-theme-text">{category}:</span> {markers.join(', ')}
 </li>
 ))}
 </ul>
 </div>
 )}
 {missedBiomarkers.length > 0 && (
 <div className="pt-4 border-t border-theme-border/50">
 <span className="flex items-center gap-1.5 font-bold text-theme-critical mb-1">
 <AlertCircle size={16} /> Prior Abnormalities:
 </span>
 <span className="block mb-2 text-theme-text-sec">These markers required attention previously but were missed in the latest report:</span>
 <ul className="list-disc pl-5 space-y-1 text-theme-text-sec">
 {(Object.entries(missedBiomarkersCategorized) as [string, string[]][]).map(([category, markers]) => (
 <li key={category}>
 <span className="font-semibold text-theme-text">{category}:</span> {markers.join(', ')}
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 
 <div className="pt-4 border-t border-theme-border mt-auto">
 <p className="text-xs text-theme-text-sec leading-relaxed">
 For a more comprehensive assessment of your health, consider including these biomarkers in your next preventive health check-up.
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Selected Biomarker Modal */}

 {selectedBiomarker && (
 <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 pb-0 sm:pb-6 animate-in fade-in duration-200" style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
 <div 
 className="bg-theme-bg w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-theme-border border-dashedshadow-2xl flex flex-col"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="sticky top-0 bg-theme-bg/80 backdrop-blur-md border-b border-theme-border p-4 sm:p-6 flex items-start justify-between z-10">
 <div>
 <h2 className="text-xl sm:text-2xl font-black text-theme-text mb-1 flex items-center gap-2">
 {selectedBiomarker.biomarker.name}
 </h2>
 <p className="text-theme-text-sec text-sm font-medium">{selectedBiomarker.biomarker.category}</p>
 </div>
 <button 
 onClick={() => setSelectedBiomarker(null)}
 className="p-2 bg-theme-card hover:bg-theme-card-sec rounded-full text-theme-text-sec hover:text-theme-text transition-colors"
 >
 <X size={20} />
 </button>
 </div>
 
 <div className="p-4 sm:p-6 space-y-6">
 {selectedBiomarker.biomarker.info && (
 <div className="bg-theme-card border border-theme-border border-dashedp-4 sm:p-5 rounded-2xl flex items-start gap-3 shadow-sm">
 <div className="mt-0.5 text-blue-500 shrink-0">
 <Info size={18} />
 </div>
 <p className="text-sm text-theme-text leading-relaxed">
 {selectedBiomarker.biomarker.info}
 </p>
 </div>
 )}
 
 {selectedBiomarker.history.length > 0 ? (
 <div className="bg-theme-card border border-theme-border border-dashedp-4 sm:p-6 rounded-3xl shadow-sm">
 <h3 className="text-sm font-bold text-theme-text-sec mb-6">Historical Trend</h3>
 <div className="h-64 w-full">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={selectedBiomarker.history.map(h => ({ ...h, timestamp: parseISO(h.date).getTime() })).sort((a,b) => a.timestamp - b.timestamp)} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="var(--color-theme-border)" vertical={false} />
 <XAxis 
 dataKey="date" 
 axisLine={false} 
 tickLine={false} 
 tick={{fontSize: 12, fill: 'var(--color-theme-text-sec)'}} 
 dy={10} 
 />
 <YAxis 
 axisLine={false} 
 tickLine={false} 
 tick={{fontSize: 12, fill: 'var(--color-theme-text-sec)'}} 
 domain={[
 (dataMin: number) => {
 const refMin = selectedBiomarker.biomarker.refMin;
 const trueMin = refMin !== undefined && refMin !== null ? Math.min(dataMin, refMin) : dataMin;
 const margin = trueMin === 0 ? 0 : Math.abs(trueMin) * 0.1;
 return Math.max(0, trueMin - margin);
 },
 (dataMax: number) => {
 const refMax = selectedBiomarker.biomarker.refMax;
 const trueMax = refMax !== undefined && refMax !== null ? Math.max(dataMax, refMax) : dataMax;
 const margin = trueMax === 0 ? 1 : Math.abs(trueMax) * 0.1;
 return trueMax + margin;
 }
 ]} 
 />
 <Tooltip 
 contentStyle={{ borderRadius: '16px', border: '1px solid var(--color-theme-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', backgroundColor: 'var(--color-theme-card)', color: 'var(--color-theme-text)' }}
 formatter={(val: number) => [`${val} ${selectedBiomarker.biomarker.unit}`, selectedBiomarker.biomarker.name]}
 labelStyle={{ color: 'var(--color-theme-text-sec)', marginBottom: '4px' }}
 />
 
{selectedBiomarker.biomarker.refMin != null && selectedBiomarker.biomarker.refMax != null && (
  <ReferenceArea  
                          
                           
 y1={Number(selectedBiomarker.biomarker.refMin)} 
 y2={Number(selectedBiomarker.biomarker.refMax)}
 {...({ fill: "#22c55e", fillOpacity: 0.15, stroke: "none", ifOverflow: "extendDomain" } as any)}
 />
)}
{selectedBiomarker.biomarker.refMin != null && selectedBiomarker.biomarker.refMax != null && (
  <ReferenceLine y={Number(selectedBiomarker.biomarker.refMax)} stroke="#22c55e" strokeWidth={2} strokeDasharray="4 4" opacity={0.8} ifOverflow="extendDomain" />
)}
{selectedBiomarker.biomarker.refMin != null && selectedBiomarker.biomarker.refMax != null && (
  <ReferenceLine y={Number(selectedBiomarker.biomarker.refMin)} stroke="#22c55e" strokeWidth={2} strokeDasharray="4 4" opacity={0.8} ifOverflow="extendDomain" />
)}

 {(selectedBiomarker.biomarker.refMin != null || selectedBiomarker.biomarker.refMax != null) && !(selectedBiomarker.biomarker.refMin != null && selectedBiomarker.biomarker.refMax != null) && (
 <ReferenceLine 
 y={Number(selectedBiomarker.biomarker.refMin ?? selectedBiomarker.biomarker.refMax)} 
 stroke="#22c55e" 
 strokeWidth={2}
 strokeDasharray="4 4"
 opacity={0.8}
 ifOverflow="extendDomain"
 />
 )}
 <Line 
 type="monotone" 
 dataKey="value" 
 stroke="var(--color-theme-text)" 
 strokeWidth={3} 
 dot={{ r: 4, fill: 'var(--color-theme-bg)', strokeWidth: 2, stroke: 'var(--color-theme-text)' }}
 activeDot={{ r: 6, fill: 'var(--color-theme-text)', stroke: 'var(--color-theme-bg)', strokeWidth: 2 }}
 />
 </LineChart>
 </ResponsiveContainer>
 </div>
 </div>
 ) : (
 <div className="bg-theme-card border border-theme-border border-dashedp-8 rounded-3xl text-center">
 <div className="w-12 h-12 mx-auto bg-theme-bg rounded-full flex items-center justify-center text-theme-text-sec mb-3">
 <Activity size={20} />
 </div>
 <p className="text-theme-text font-bold">No historical data</p>
 <p className="text-theme-text-sec text-sm mt-1">This is the first time this biomarker has been measured.</p>
 </div>
 )}
 </div>
 </div>
 </div>
 )}


 {showSugarHealth && (
 <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-theme-bg/80 backdrop-blur-sm animate-in fade-in duration-200">
 <div className="bg-theme-card border border-theme-border border-dashedrounded-[32px] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
 <div className="sticky top-0 bg-theme-card/90 backdrop-blur-md z-10 flex items-center justify-between p-6 sm:p-8 border-b border-theme-border">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 text-purple-500">
 <Hexagon size={20} className="animate-[spin_4s_linear_infinite]" />
 </div>
 <h3 className="text-2xl font-bold text-theme-text font-sans tracking-tight">Sugar Health</h3>
 </div>
 <button onClick={() => setShowSugarHealth(false)} className="w-10 h-10 rounded-full bg-theme-bg flex items-center justify-center text-theme-text-sec hover:text-theme-text transition-colors border border-theme-border border-dashed">
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
 <div key={i} className="p-4 rounded-2xl bg-theme-bg border border-theme-border border-dashedflex flex-col justify-center items-center text-center">
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
 <p className="text-sm text-theme-text-sec mt-2">Log more glucose readings to unlock your Sugar Health insights.</p>
 </div>
 )}
 </div>
 </div>
 </div>
 )}

 {showBmiInfo && (
 <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-theme-bg/80 backdrop-blur-sm animate-in fade-in duration-200">
 <div className="bg-theme-card border border-theme-border border-dashedrounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
 <div className="flex items-center justify-between p-6 border-b border-theme-border">
 <h3 className="text-xl font-bold text-theme-text font-sans">BMI Classifications</h3>
 <button onClick={() => setShowBmiInfo(false)} className="text-theme-text-sec hover:text-theme-text hover:bg-theme-bg p-2 rounded-full transition-colors">
 <X size={20} />
 </button>
 </div>
 <div className="p-6 space-y-4 text-sm text-theme-text">
 <p className="font-medium text-theme-text-sec mb-2">South East Asian WHO Classification:</p>
 <ul className="space-y-2 font-sans">
 <li className="flex justify-between"><span>Underweight</span><span className="font-bold">&lt; 18.5 kg/m²</span></li>
 <li className="flex justify-between"><span>Normal Range</span><span className="font-bold">18.5 - 22.9 kg/m²</span></li>
 <li className="flex justify-between"><span>Overweight</span><span className="font-bold">23.0 - 24.9 kg/m²</span></li>
 <li className="flex justify-between"><span>Obese Class I</span><span className="font-bold">25.0 - 29.9 kg/m²</span></li>
 <li className="flex justify-between"><span>Obese Class II</span><span className="font-bold">≥ 30.0 kg/m²</span></li>
 </ul>
 <div className="mt-6 pt-4 border-t border-theme-border text-xs text-theme-text-sec font-sans leading-relaxed">
 <span className="font-bold text-theme-text">Note:</span> BMI is not the only way to measure health. Bodybuilders, pregnant women, etc., and other users should refer to other methodologies.
 </div>
 </div>
 </div>
 </div>
 )}

 </div>
 );
}

function FamilyCategoryGroup({ category, biomarkers, getHistory, onSelectBiomarker }: { key?: React.Key, category: string, biomarkers: any[], getHistory: (name: string) => any[], onSelectBiomarker: (b: any, h: any[]) => void }) {
 const [isOpen, setIsOpen] = useState(false);
 
 const highLowCount = biomarkers.filter(b => b.status === "Needs Attention").length;
 const borderlineCount = biomarkers.filter(b => b.status === 'Borderline').length;

 return (
 <div className="bg-theme-card rounded-3xl border border-theme-border border-dashedoverflow-hidden shadow-sm transition-all">
 <button 
 onClick={() => setIsOpen(!isOpen)}
 className="w-full flex items-center justify-between p-5 bg-theme-card hover:bg-theme-card-sec transition-colors text-left"
 >
 <div className="flex items-center gap-3">
 <h3 className="font-bold text-theme-text text-lg">{category}</h3>
 {!isOpen && (
 <div className="flex gap-2">
 {borderlineCount > 0 && (
 <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-bold transition-colors bg-theme-warning/10 border-theme-warning/30 text-theme-warning">
 <span className="w-2.5 h-2.5 rounded-full border-2 relative border-[var(--color-theme-warning)]" />
 {borderlineCount}
 </span>
 )}
 {highLowCount > 0 && (
 <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-bold transition-colors bg-theme-critical/10 border-theme-critical text-red-700">
 <span className="w-2.5 h-2.5 rounded-full border-2 relative border-theme-critical" />
 {highLowCount}
 </span>
 )}
 </div>
 )}
 </div>
 {isOpen ? <ChevronUp className="text-theme-text-sec" /> : <ChevronDown className="text-theme-text-sec" />}
 </button>
 
 {isOpen && (
 <div className="flex flex-col gap-2 px-2 pb-2 mt-2">
 {biomarkers.map((b, i) => (
 <FamilyBiomarkerRow 
 key={i} 
 biomarker={b} 
 getHistory={getHistory} 
 onSelectBiomarker={onSelectBiomarker} 
 />
 ))}
 </div>
 )}
 </div>
 );
}

function FamilyBiomarkerRow({ biomarker, getHistory, onSelectBiomarker }: { key?: React.Key, biomarker: any, getHistory: (name: string) => any[], onSelectBiomarker: (b: any, h: any[]) => void }) {
 const result = calculateStatus(biomarker.biomarkerId || biomarker.name, biomarker.value, biomarker.refMin, biomarker.refMax, biomarker.status, biomarker.refRangeText);
 const finalStatus = result.status;
 
 const history = getHistory(biomarker.biomarkerId || biomarker.name);
 const hasTrend = TIER_1.includes(biomarker.name.toLowerCase().trim());
 const isClickable = hasTrend || result.info;

 let diffString = null;
 let diffPrefix = '';
 if (history.length > 1) {
 const prevVal = Number(history[history.length - 2].value);
 const curVal = Number(biomarker.value);
 if (!isNaN(prevVal) && !isNaN(curVal)) {
 const diff = curVal - prevVal;
 if (diff !== 0) {
 diffPrefix = diff > 0 ? '↑' : '↓';
 diffString = `${diffPrefix} ${Math.abs(diff).toFixed(diff % 1 !== 0 ? 1 : 0)}`;
 }
 }
 }

 return (
 <div 
 onClick={() => { if (isClickable) onSelectBiomarker(biomarker, history) }}
 className={cn(
 "p-3 sm:p-4 mx-2 rounded-2xl flex flex-row items-center justify-between transition-colors mb-1 group", 
 finalStatus === 'Healthy' ? "bg-transparent hover:bg-theme-card-sec" : 
 finalStatus === 'Needs Attention' ? "bg-theme-critical/5 hover:bg-theme-critical/10" : 
 "bg-theme-warning/5 hover:bg-theme-warning/10",
 isClickable ? "cursor-pointer" : "cursor-default"
 )}
 >
 <div className="flex-1 flex flex-col justify-center">
 <h4 className="font-bold text-theme-text text-sm sm:text-base leading-tight flex flex-wrap items-center gap-2">
 {biomarker.name}
 {result.info && (
 <div className="group/info relative z-10 hidden sm:block">
 <Info size={14} className="text-theme-text-sec shrink-0 cursor-help" />
 <div className="invisible group-hover/info:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-theme-card border border-theme-border border-dashedrounded-xl shadow-xl text-xs text-theme-text text-center z-50">
 {result.info}
 <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-theme-border" />
 </div>
 </div>
 )}
 </h4>
 {(result.refRangeText || (result.refMin != null || result.refMax != null)) && (
 <span className="text-xs font-medium text-theme-text-sec mt-0.5">
 Ref: {result.refRangeText || (result.refMin === 0 && result.refMax === 0 ? 'Not specified' : `${result.refMin ?? '?'} - ${result.refMax ?? '?'}`)}
 </span>
 )}
 </div>
 
 <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-right">
 {diffString && (
 <div className={cn("text-xs sm:text-sm font-bold flex items-center gap-0.5", finalStatus === 'Healthy' ? "text-theme-text-sec" : finalStatus === 'Needs Attention' ? "text-theme-critical" : "text-theme-warning")}>
 {diffString}
 </div>
 )}
 <div className="flex items-baseline gap-1 min-w-[3rem] justify-end">
 <span className={cn("text-lg sm:text-xl font-bold tracking-tight", finalStatus === 'Healthy' ? "text-theme-text" : finalStatus === 'Needs Attention' ? "text-theme-critical" : "text-theme-warning")}>{biomarker.value}</span>
 <span className="text-xs sm:text-sm font-medium text-theme-text-sec hidden sm:inline-block truncate">{biomarker.unit}</span>
 </div>
 
 <div className="w-[18px] flex justify-end shrink-0">
 {isClickable && <ChevronRight size={18} className="text-theme-border group-hover:text-theme-text-sec transition-colors" />}
 </div>
 </div>
 

 </div>
 );
}

