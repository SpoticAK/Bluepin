import { ActivityCircle, emojiToStatus } from './ActivityCircle';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAppStore } from '../store';
import { CheckCircle, Activity, Target, Circle, Plus, Settings2, Flame, RefreshCcw, X, Trash2, Sparkles, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Loader2, Check, Asterisk, Sparkle, Info } from 'lucide-react';
import { startOfDay, subDays, isSameDay } from 'date-fns';
import { cn, calculateBMI, safeFormat } from '../lib/utils';
import { calculateGoalsStreak, getActiveGoalsForDate as libGetActiveGoals } from '../lib/goalUtils';
import { Goal } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_GOALS } from '../data';

export default function FitnessTab() {
 const { goals, goalLogs, logGoal, toggleGoalActive, weightEntries, profile, addWeightEntry, addCustomGoal, removeGoal, labReports } = useAppStore();
 const [selectedDate, setSelectedDate] = useState<string>(safeFormat(new Date(), 'yyyy-MM-dd'));
 const [streakOffset, setStreakOffset] = useState(0);
 const [isGoalsExpanded, setIsGoalsExpanded] = useState(false);
 const [showWeightModal, setShowWeightModal] = useState(false);
 const [showCustomGoalModal, setShowCustomGoalModal] = useState(false);
 const [showRecommendationsModal, setShowRecommendationsModal] = useState(false);
 const [isGeneratingRecs, setIsGeneratingRecs] = useState(false);
 const [recommendationPlan, setRecommendationPlan] = useState<any>(null);
 const [selectedCategory, setSelectedCategory] = useState<string>('All');
 const [showHealthCoachInfo, setShowHealthCoachInfo] = useState(false);

 const renderStatusCircle = (emojiStr: string, isSelected: boolean) => {
    return <ActivityCircle status={emojiToStatus(emojiStr)} isSelected={isSelected} size="lg" />;
  };

 useEffect(() => {
 const plan = localStorage.getItem('fitnessRecommendationPlan');
 if (plan) {
 try {
 setRecommendationPlan(JSON.parse(plan));
 } catch(e){}
 }
 }, []);
 const [customGoalData, setCustomGoalData] = useState({ title: '', category: 'Custom Goals', targetType: 'checkbox' as 'checkbox' | 'number', targetValue: '', unit: '' });

 const [isSubmittingGoal, setIsSubmittingGoal] = useState(false); const handleCreateCustomGoal = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!customGoalData.title) return;
 const newGoal: any = {
 id: uuidv4(),
 title: customGoalData.title,
 category: customGoalData.category,
 frequency: "daily",
 targetType: customGoalData.targetType,
 isActive: true,
 };
 if (customGoalData.targetType === 'number') {
 newGoal.targetValue = Number(customGoalData.targetValue) || 0;
 if (customGoalData.unit) {
 newGoal.unit = customGoalData.unit;
 }
 }
 setIsSubmittingGoal(true); try { await addCustomGoal(newGoal); 
 setShowCustomGoalModal(false);
 setCustomGoalData({ title: '', category: 'Custom Goals', targetType: 'checkbox', targetValue: '', unit: '' }); } catch(e: any) { alert(e.message || "Failed to create goal"); } finally { setIsSubmittingGoal(false); }
 };

 const todayStr = safeFormat(new Date(), 'yyyy-MM-dd');
 const yesterdayStr = safeFormat(subDays(new Date(), 1), 'yyyy-MM-dd');

 const getActiveGoalsForDate = useCallback((dateStr: string) => {
    return libGetActiveGoals(goals, dateStr);
  }, [goals]);

 const activeGoals = getActiveGoalsForDate(selectedDate);
 const inactiveDefaultGoals = goals.filter(g => !g.isActive && DEFAULT_GOALS.some(dg => dg.id === g.id));
 const customGoals = goals.filter(g => !DEFAULT_GOALS.some(dg => dg.id === g.id));

 const [showYesterdayReminder, setShowYesterdayReminder] = useState(() => {
 const dDate = localStorage.getItem('yesterdayReminderDismissedDate');
 const yStr = safeFormat(subDays(new Date(), 1), 'yyyy-MM-dd');
 return dDate !== yStr;
 });

 const { currentStreak, highestStreak, streakDays, currentPartials, canGoBack, canGoForward } = useMemo(() => {
    return calculateGoalsStreak(goals, goalLogs, streakOffset);
  }, [goalLogs, goals, streakOffset]);

 // Get selected day's logs
 const currentLogs = goalLogs[selectedDate] || {};

 // Status for today
 const allCompleted = activeGoals.length > 0 && activeGoals.every(g => currentLogs[g.id]?.completed);
 const someCompleted = activeGoals.some(g => currentLogs[g.id]?.completed);
 const isSelectedToday = selectedDate === todayStr;
 const showReadyToGo = isSelectedToday && !someCompleted && !allCompleted;

 const yesterdayLogs = goalLogs[yesterdayStr];
 const yesterdayActiveGoals = getActiveGoalsForDate(yesterdayStr);
 const yesterdayCompleted = yesterdayLogs 
 ? Object.entries(yesterdayLogs).some(([gid, l]: [string, any]) => l.completed && yesterdayActiveGoals.some(g => g.id === gid)) 
 : false;
 const showReminder = showYesterdayReminder && !yesterdayCompleted;

 const dismissReminder = () => {
 localStorage.setItem('yesterdayReminderDismissedDate', yesterdayStr);
 setShowYesterdayReminder(false);
 };

 const [newWeight, setNewWeight] = useState('');

 const [isSubmittingWeight, setIsSubmittingWeight] = useState(false); const handleLogWeight = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!newWeight || isNaN(Number(newWeight)) || Number(newWeight) <= 0) return;
 
 const todayStr = safeFormat(new Date(), 'yyyy-MM-dd');
 const existingEntry = weightEntries.find(w => w.date === todayStr);

 setIsSubmittingWeight(true); try { await addWeightEntry({
 id: existingEntry ? existingEntry.id : uuidv4(),
 weight: Number(newWeight),
 date: todayStr,
 createdAt: Date.now()
 });
 setNewWeight('');
 setShowWeightModal(false); } catch (e: any) { alert(e.message || "Failed to add weight"); } finally { setIsSubmittingWeight(false); }
 };

 const sortedWeightData = useMemo(() => {
 const dataWithTimestamps = [...weightEntries].map(w => {
 let timestamp = new Date(w.date).getTime();
 if (w.createdAt) {
 if (typeof w.createdAt === 'number') {
 timestamp = w.createdAt;
 } else if ((w.createdAt as any).toDate) {
 timestamp = (w.createdAt as any).toDate().getTime();
 }
 }
 return {
 ...w,
 timestamp,
 fullDateTime: safeFormat(new Date(timestamp), 'MMM d, yyyy h:mm a'),
 timeStr: safeFormat(new Date(timestamp), 'h:mm a')
 };
 });

 const groupedByDate: Record<string, typeof dataWithTimestamps[0]> = {};
 dataWithTimestamps.forEach(w => {
 if (!groupedByDate[w.date] || groupedByDate[w.date].timestamp < w.timestamp) {
 groupedByDate[w.date] = w;
 }
 });

 return Object.values(groupedByDate).sort((a,b) => a.timestamp - b.timestamp);
 }, [weightEntries]);

 const bmiData = useMemo(() => {
 return sortedWeightData.map(w => ({
 date: w.date,
 timestamp: w.timestamp,
 bmi: calculateBMI(w.weight, profile.heightCm),
 fullDateTime: w.fullDateTime
 }));
 }, [sortedWeightData, profile.heightCm]);

 const getBmiClassification = (bmi: number) => {
 if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-500', bg: 'bg-blue-50' };
 if (bmi < 23) return { label: 'Normal', color: 'text-theme-success', bg: 'bg-theme-success/10' };
 if (bmi < 25) return { label: 'Overweight', color: 'text-yellow-500', bg: 'bg-yellow-50' };
 if (bmi < 30) return { label: 'Obese 1', color: 'text-orange-500', bg: 'bg-orange-50' };
 return { label: 'Obese 2', color: 'text-theme-critical', bg: 'bg-theme-critical/10' };
 };

 const latestWeightData = sortedWeightData.length > 0 ? sortedWeightData[sortedWeightData.length - 1] : null;
 const latestBmi = latestWeightData ? calculateBMI(latestWeightData.weight, profile.heightCm) : null;
 const latestBmiCls = latestBmi ? getBmiClassification(latestBmi) : null;

 const latestLabReport = useMemo(() => {
 if (!labReports || labReports.length === 0) return null;
 return [...labReports].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
 }, [labReports]);

 const shouldRegenerate = useCallback(() => {
 if (!recommendationPlan) return true;
 const oneWeek = 7 * 24 * 60 * 60 * 1000;
 if (Date.now() - recommendationPlan.generatedAt > oneWeek) return true;
 if (latestBmi && Math.abs(latestBmi - recommendationPlan.bmiAtGeneration) > 0.5) return true;
 if (latestLabReport && (!recommendationPlan.labReportId || latestLabReport.id !== recommendationPlan.labReportId)) return true;
 return false;
 }, [recommendationPlan, latestBmi, latestLabReport]);

 const generateRecommendations = useCallback(() => {
 setIsGeneratingRecs(true);
 setTimeout(() => {
 let summary = `Based on your current BMI (${latestBmi?.toFixed(1) || 'N/A'}) and recent trends, your biggest opportunities this week are improving consistency, prioritizing nutrition, and maintaining daily activity.`;
 
 let outOfRangeBms = [];
 if (latestLabReport) {
 outOfRangeBms = latestLabReport.biomarkers.filter((b: any) => b.status === 'Needs Attention' || b.status === 'Borderline');
 }

 let recommendedGoals = [
 { id: uuidv4(), title: 'Walk 10,000 steps', category: 'Activity', selected: true },
 { id: uuidv4(), title: 'Exercise for 30 minutes', category: 'Activity', selected: false },
 { id: uuidv4(), title: 'Sleep before 11 PM', category: 'Recovery', selected: true },
 ];

 if (outOfRangeBms.length > 0) {
 const names = outOfRangeBms.slice(0, 3).map((b: any) => b.name).join(', ');
 summary = `Based on your recent lab report (attention needed for ${names}) and BMI (${latestBmi?.toFixed(1) || 'N/A'}), your biggest opportunities this week are specific diet adjustments and consistent daily activity.`;

 const hasCholesterol = outOfRangeBms.some((b: any) => ['LDL', 'Triglycerides', 'Total Cholesterol'].includes(b.name));
 const hasSugar = outOfRangeBms.some((b: any) => ['HbA1c', 'Fasting Glucose'].includes(b.name));
 const hasVitamins = outOfRangeBms.some((b: any) => ['Vitamin D', 'Vitamin B12', 'Iron', 'Calcium'].includes(b.name));

 if (hasCholesterol) {
 recommendedGoals.push({ id: uuidv4(), title: 'Avoid deep-fried food', category: 'Nutrition', selected: true });
 recommendedGoals.push({ id: uuidv4(), title: 'Eat 3 Servings Veggies', category: 'Nutrition', selected: true });
 }
 if (hasSugar) {
 recommendedGoals.push({ id: uuidv4(), title: 'Avoid sugary drinks', category: 'Nutrition', selected: true });
 recommendedGoals.push({ id: uuidv4(), title: 'No Sugar', category: 'Nutrition', selected: true });
 }
 if (hasVitamins) {
 recommendedGoals.push({ id: uuidv4(), title: 'Take Supplements', category: 'Health', selected: true });
 recommendedGoals.push({ id: uuidv4(), title: 'Get 15 mins of sunlight', category: 'Health', selected: false });
 }
 
 if (!hasCholesterol && !hasSugar && !hasVitamins) {
 recommendedGoals.push({ id: uuidv4(), title: 'Drink 2L Water', category: 'Nutrition', selected: true });
 recommendedGoals.push({ id: uuidv4(), title: 'Take prescribed medications', category: 'Health', selected: true });
 }
 } else {
 recommendedGoals.push({ id: uuidv4(), title: 'Avoid deep-fried food', category: 'Nutrition', selected: true });
 recommendedGoals.push({ id: uuidv4(), title: 'Avoid sugary drinks', category: 'Nutrition', selected: true });
 recommendedGoals.push({ id: uuidv4(), title: 'Meditate for 20 minutes', category: 'Mindfulness', selected: false });
 recommendedGoals.push({ id: uuidv4(), title: 'Take prescribed medications', category: 'Health', selected: true });
 }

 const newPlan = {
 generatedAt: Date.now(),
 bmiAtGeneration: latestBmi || 0,
 labReportId: latestLabReport?.id || null,
 summary,
 goals: recommendedGoals,
 accepted: false
 };
 localStorage.setItem('fitnessRecommendationPlan', JSON.stringify(newPlan));
 setRecommendationPlan(newPlan);
 setIsGeneratingRecs(false);
 }, 1500);
 }, [latestBmi, latestLabReport]);

 const handleOpenRecommendations = () => {
 setShowRecommendationsModal(true);
 if (shouldRegenerate() || !recommendationPlan || recommendationPlan.accepted) {
 generateRecommendations();
 }
 };

 const toggleRecSelected = (id: string) => {
 if (!recommendationPlan) return;
 const updated = { ...recommendationPlan, goals: recommendationPlan.goals.map((g: any) => g.id === id ? { ...g, selected: !g.selected } : g) };
 setRecommendationPlan(updated);
 localStorage.setItem('fitnessRecommendationPlan', JSON.stringify(updated));
 };

 const handleAcceptRecommendations = async (acceptAll: boolean = false) => {
 if (!recommendationPlan) return;
 const toAccept = acceptAll ? recommendationPlan.goals : recommendationPlan.goals.filter((r: any) => r.selected);
 try {
   for (const r of toAccept) {
     const newGoal: any = {
       id: r.id,
       title: r.title,
       category: r.category,
       frequency: "daily",
       targetType: "checkbox",
       isActive: true,
     };
     await addCustomGoal(newGoal);
   }
   const updatedPlan = { ...recommendationPlan, accepted: true };
   localStorage.setItem('fitnessRecommendationPlan', JSON.stringify(updatedPlan));
   setRecommendationPlan(updatedPlan);
   setShowRecommendationsModal(false);
 } catch(e: any) {
   alert(e.message || "Failed to accept recommendations");
 }
 };

 const handleIgnoreRecommendations = () => {
 if (!recommendationPlan) return;
 const updatedPlan = { ...recommendationPlan, accepted: true };
 localStorage.setItem('fitnessRecommendationPlan', JSON.stringify(updatedPlan));
 setRecommendationPlan(updatedPlan);
 setShowRecommendationsModal(false);
 };

 return (
 <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 mt-4 md:-mt-8">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <h2 className="text-4xl font-display font-medium text-theme-text tracking-tight">Fitness & Goals</h2>
 
 <div className="flex flex-col items-end gap-2 w-full sm:w-auto mt-4 sm:mt-0">
 <div className="flex items-center gap-2 w-full sm:w-auto">
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
 {currentPartials === 3 && currentStreak > 0 && (
 <div className="bg-red-50 border border-red-100 px-3 py-1.5 rounded-xl w-full sm:w-auto mt-2">
 <p className="text-[10px] font-bold text-red-600 animate-pulse text-center sm:text-right">
 1 more partial day will break streak
 </p>
 </div>
 )}
 </div>
 </div>

 {showReminder && (
 <div className="bg-orange-50/80 border border-orange-200/60 rounded-[32px] p-6 sm:p-8 shadow-sm relative animate-in fade-in zoom-in-95 overflow-hidden">
 {/* Decorative background circle */}
 <div className="absolute -top-12 -right-12 w-32 h-32 bg-orange-200/30 rounded-full blur-2xl" />
 
 <button onClick={dismissReminder} className="absolute top-4 right-4 text-orange-400 hover:text-orange-600 bg-white rounded-full p-2 shadow-sm transition-transform hover:scale-110 z-10">
 <X size={18} strokeWidth={3} />
 </button>
 <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 relative z-10">
 <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center shrink-0 border border-orange-100">
 <Activity className="w-8 h-8 text-orange-400" />
 </div>
 <div className="flex-1">
 <h3 className="font-display font-medium text-orange-900 text-2xl mb-1">Did you complete your goals yesterday?</h3>
 <p className="text-orange-800/80 text-sm font-medium mb-6">We noticed you didn't check off any goals yesterday. If you did them, don't lose your streak!</p>
 
 <div className="space-y-2 bg-white/60 rounded-[24px] p-4 mb-6 border border-white">
 <p className="text-[10px] font-bold text-orange-800/60 mb-3 px-2">Check what you completed:</p>
 {getActiveGoalsForDate(yesterdayStr).map(goal => {
 const isGoalCompleted = yesterdayLogs?.[goal.id]?.completed || false;
 return (
 <button 
 key={goal.id} 
 onClick={async () => { try { await logGoal(yesterdayStr, goal.id, !isGoalCompleted); } catch(e: any) { alert(e.message || "Failed to log goal"); } }}
 className={cn("flex items-center gap-4 w-full text-left p-3 rounded-2xl transition-all border-2", isGoalCompleted ? "bg-white border-orange-200 shadow-sm" : "border-transparent hover:bg-white/40")}
 >
 {isGoalCompleted ? (
 <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
 <Check className="w-4 h-4 text-orange-600" /> 
 </div>
 ) : (
 <div className="w-6 h-6 rounded-full border-2 border-orange-200 shrink-0" />
 )}
 <span className={cn("text-sm font-medium transition-all", isGoalCompleted ? "text-orange-900" : "text-orange-800/70")}>{goal.title}</span>
 </button>
 );
 })}
 </div>

 <div className="flex flex-wrap gap-3">
 <button onClick={dismissReminder} className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-sm font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5">
 Save & Update Streak
 </button>
 <button onClick={dismissReminder} className="px-6 py-3 bg-white hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-2xl text-sm font-bold transition-all">
 No, I didn't (Break streak)
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
 
 {/* Left Col: Goals */}
 <div className="space-y-6">
 <div className="flex items-center justify-between bg-theme-card px-5 py-5 sm:px-6 rounded-[32px] border border-theme-border border-dashedshadow-sm overflow-x-auto scrollbar-hide">
 <div className="flex items-center gap-3 sm:gap-4 min-w-max w-full justify-between relative px-2">
 {canGoBack && (
            <button onClick={() => setStreakOffset(prev => prev + 7)} className="z-10 p-1 text-theme-text-sec hover:text-theme-text bg-theme-bg rounded-full shadow-sm border border-theme-border border-dashedshrink-0">
              <ChevronLeft size={16} />
            </button>
          )}
          {!canGoBack && <div className="w-[26px] shrink-0"></div>}
          <div className="flex-1 flex justify-between px-0 sm:px-2 relative">
            {streakDays.map((sd, i) => {
              const isSelected = selectedDate === sd.dStr;
              const hasNext = i < streakDays.length - 1;
              const nextIsBreak = hasNext && streakDays[i+1].isBreak;
              
              return (
                <div key={sd.dStr} className="relative flex-1 flex flex-col items-center">
                  <button 
                    onClick={() => setSelectedDate(sd.dStr)}
                    className="flex flex-col items-center gap-2 z-10 hover:opacity-80 transition-all outline-none relative"
                  >
                    <div className="relative z-10 bg-theme-card">{renderStatusCircle(sd.emoji, isSelected)}</div>
                    <span className={cn("text-[10px] font-medium transition-colors relative z-10 px-1", isSelected ? "text-theme-text font-bold" : "text-theme-text-sec")}>
                      {isSameDay(sd.date, new Date()) ? 'TODAY' : safeFormat(sd.date, 'EEEEE')}
                    </span>
                  </button>
                  {hasNext && (
                    <div className={cn(
                      "absolute top-[10px] sm:top-[12px] left-1/2 w-full h-[2px] sm:h-[3px] rounded-full z-0",
                      nextIsBreak ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-theme-border/60"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
          {canGoForward && (
 <button onClick={() => setStreakOffset(prev => Math.max(0, prev - 7))} className="z-10 p-1 text-theme-text-sec hover:text-theme-text bg-theme-bg rounded-full shadow-sm border border-theme-border border-dashed">
 <ChevronRight size={16} />
 </button>
 )}
 {!canGoForward && <div className="w-[26px]"></div>}
 </div>
 </div>

 {/* Your Goals */}
 <div className="bg-theme-card rounded-[32px] border border-theme-border border-dashedshadow-sm overflow-hidden">
 <div className={cn("p-6 sm:p-8 text-white transition-colors border-b border-white/5 bg-gradient-to-br from-white/10 to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]", allCompleted ? "bg-green-700" : someCompleted ? "bg-amber-500" : showReadyToGo ? "bg-neutral-800" : "bg-orange-800")}>
 <h3 className="text-2xl font-display font-medium mb-1.5 flex items-center gap-2">
 {allCompleted ? "Perfect Day" : someCompleted ? "Progress Day" : showReadyToGo ? "Ready to go" : "Missed Day"}
 </h3>
 <p className="text-white/90 text-sm font-medium">
 {allCompleted ? "You completed all your active goals." : someCompleted ? "You're on the right track. Keep it up!" : showReadyToGo ? "Check off goals to build your streak." : "No goals were completed this day."}
 </p>
 </div>
 <div className="p-4 sm:p-6">
 <h3 className="text-xs font-bold text-theme-text-sec mb-4 px-2">Your Goals</h3>
 {activeGoals.length === 0 ? (
 <div className="p-8 flex flex-col items-center justify-center text-center bg-theme-bg rounded-3xl border border-theme-border border-dashed">
 <Target className="text-neutral-300 mb-3" size={40} />
 <p className="text-theme-text-sec font-medium">No active goals. Add some from the library below.</p>
 </div>
 ) : (
 <>
 <ul className="space-y-3">
 {(isGoalsExpanded ? activeGoals : activeGoals.slice(0, 3)).map(goal => {
 const logData = currentLogs[goal.id];
 const isCompleted = logData?.completed || false;
 return (
 <li key={goal.id} className="group relative bg-theme-bg hover:bg-theme-card-sec rounded-3xl border-2 border-theme-border/60 hover:border-theme-border transition-colors flex items-center pr-2 shadow-sm hover:shadow-md">
 <button 
 onClick={async () => { if (isSelectedToday) { try { await logGoal(selectedDate, goal.id, !isCompleted); } catch(e: any) { alert(e.message || "Failed to log goal"); } } }}
 className={cn("flex-1 flex items-center gap-4 p-4 sm:p-5 transition-colors text-left rounded-l-3xl", isSelectedToday ? "cursor-pointer" : "cursor-default")}
 disabled={!isSelectedToday}
 >
 {isCompleted ? (
 <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-theme-success/20 flex items-center justify-center shrink-0">
 <Check className="w-5 h-5 sm:w-6 sm:h-6 text-theme-success" />
 </div>
 ) : (
 <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-full border-[3px] flex items-center justify-center shrink-0 transition-colors", isSelectedToday ? "border-theme-border/80 group-hover:border-theme-accent bg-theme-card" : "border-theme-border/40 bg-theme-bg")} />
 )}
 <div className="flex-1">
 <p className={cn("font-medium transition-colors text-base sm:text-lg", isCompleted ? "text-theme-text-sec line-through" : "text-theme-text")}>
 {goal.title}
 </p>
 <div className="flex items-center gap-3 mt-1">
 {goal.targetType === 'number' && goal.targetValue !== undefined && (
 <p className="text-xs font-bold text-theme-text-sec bg-theme-card border border-theme-border border-dashedpx-2 py-0.5 rounded-lg">Target: {goal.targetValue} {goal.unit}</p>
 )}
 {isCompleted && logData?.updatedAt && (
 <p className="text-[10px] text-theme-success/80 font-bold ">Logged at {safeFormat(logData.updatedAt?.toDate ? logData.updatedAt.toDate() : new Date(logData.updatedAt), 'h:mm a')}</p>
 )}
 </div>
 </div>
 </button>
 {isSelectedToday && (
 <button 
 onClick={async () => { try { await toggleGoalActive(goal.id, false); } catch(e: any) { alert(e.message || "Failed to update goal"); } }}
 className="p-3 text-theme-border hover:bg-theme-card hover:text-theme-critical hover:shadow-sm rounded-2xl transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 mr-1"
 title="Remove goal"
 >
 <X size={20} />
 </button>
 )}
 </li>
 );
 })}
 </ul>
 {activeGoals.length > 3 && (
 <button
 onClick={() => setIsGoalsExpanded(!isGoalsExpanded)}
 className="w-full mt-4 py-3 rounded-2xl border-2 border-theme-border/50 bg-theme-bg/50 hover:bg-theme-card-sec text-theme-text flex items-center justify-center gap-2 text-sm font-medium transition-all"
 >
 {isGoalsExpanded ? (
 <>Collapse <ChevronUp size={16} /></>
 ) : (
 <>See all {activeGoals.length} goals <ChevronDown size={16} /></>
 )}
 </button>
 )}
 </>
 )}
 </div>
 </div>

 {/* Goal Library - Only visible when editing Today */}
 {selectedDate === todayStr && (
 <div className="space-y-6">
 <button
 onClick={handleOpenRecommendations}
 className="w-full relative p-3 sm:p-4 rounded-[24px] bg-gradient-to-r from-purple-500 to-violet-600 border border-purple-400/30 shadow-sm group text-left transition-all hover:shadow-lg hover:shadow-purple-500/30 overflow-hidden block"
 >
 <div className="absolute inset-0 bg-white/5 opacity-60 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
 <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none group-hover:bg-white/20 transition-all duration-700"></div>
 
 <div className="flex items-center justify-between relative z-10">
 <div className="flex items-center gap-3 sm:gap-4">
 <div className="relative group-hover:scale-110 transition-transform duration-500 flex items-center justify-center w-8 h-8">
 <div className="absolute inset-0 bg-white/20 blur-md rounded-full"></div>
 <Asterisk size={28} strokeWidth={1.5} className="text-white relative z-10 animate-[spin_8s_linear_infinite]" />
 </div>
 <h3 className="text-base sm:text-lg font-bold font-display text-white tracking-wide drop-shadow-sm flex items-center gap-2">
 Health Coach
 <div 
 onClick={(e) => { e.stopPropagation(); setShowHealthCoachInfo(true); }}
 className="text-white/60 hover:text-white transition-colors p-1 -m-1"
 >
 <Info size={16} />
 </div>
 </h3>
 </div>
 <div className="text-white/60 group-hover:text-white transition-all duration-300 transform group-hover:translate-x-1">
 <ChevronRight size={20} strokeWidth={2.5} />
 </div>
 </div>
 </button>

 <div className="bg-theme-card rounded-[32px] border border-theme-border border-dashedshadow-sm p-6 sm:p-8 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-xl font-display font-medium text-theme-text">Goal Library</h3>
 <button onClick={() => setShowCustomGoalModal(true)} className="text-sm font-medium text-theme-text hover:bg-theme-bg px-4 py-2 rounded-xl transition-colors border border-theme-border border-dashedshadow-sm">
 + Custom Goal
 </button>
 </div>
 
 {(() => {
 const normalizeCategory = (cat: string) => {
 const lower = cat.toLowerCase();
 if (lower.includes('activity') || lower.includes('exercise') || lower.includes('strength') || lower.includes('walking')) return 'Activity';
 if (lower.includes('nutrition') || lower.includes('diet')) return 'Nutrition';
 if (lower.includes('sleep') || lower.includes('mental') || lower.includes('recovery') || lower.includes('well')) return 'Recovery';
 if (lower.includes('medication') || lower.includes('health')) return 'Medication';
 return cat;
 };
 const inactiveCustomGoals = customGoals.filter(g => !g.isActive);
 const allInactiveGoals = [...inactiveDefaultGoals, ...inactiveCustomGoals];
 const defaultCats = Array.from(new Set(allInactiveGoals.map(g => normalizeCategory(g.category))));
 const availableCategories = ['All', ...defaultCats];
 
 return (
 <>
 {availableCategories.length > 1 && (
 <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide mb-2 border-b border-theme-border/50">
 {availableCategories.map(cat => (
 <button
 key={cat}
 onClick={() => setSelectedCategory(cat)}
 className={cn(
 "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
 selectedCategory === cat 
 ? cat === 'Activity' ? "bg-[#D36135] text-white" // Terracotta
 : cat === 'Nutrition' ? "bg-[#8A9A5B] text-white" // Sage/Olive
 : cat === 'Recovery' ? "bg-[#6B654B] text-white" // Muted Brown/Olive
 : cat === 'Medication' ? "bg-[#5D737E] text-white" // Muted Slate Blue
 : "bg-[#6B654B] text-white" // Default earthy
 : "bg-theme-bg text-theme-text-sec hover:bg-theme-card-sec border border-transparent hover:border-theme-border"
 )}
 >
 {cat}
 </button>
 ))}
 </div>
 )}

 <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 pt-2 scrollbar-hide">
 {inactiveDefaultGoals.length === 0 && customGoals.length === 0 ? (
 <div className="py-8 text-center text-theme-text-sec">
 <p className="text-sm font-medium">All library goals are currently active.</p>
 </div>
 ) : (
 <>
 {/* All Inactive Goals */}
 {allInactiveGoals
 .filter(g => selectedCategory === 'All' || normalizeCategory(g.category) === selectedCategory)
 .map(goal => {
 const isCustom = !DEFAULT_GOALS.some(dg => dg.id === goal.id);
 return (
 <div key={goal.id} className="group flex items-center justify-between p-4 rounded-2xl bg-theme-bg border border-theme-border border-dashed/60 hover:border-theme-border transition-colors">
 <div className="flex-1">
 <p className="font-medium text-theme-text text-[15px]">{goal.title}</p>
 {goal.targetType === 'number' && (
 <p className="text-xs font-medium text-theme-text-sec mt-1">{goal.targetValue} {goal.unit}</p>
 )}
 {isCustom && selectedCategory === 'All' && (
 <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-theme-card-sec text-theme-text-sec">Custom</span>
 )}
 </div>
 <div className="flex items-center gap-2 ml-4 shrink-0">
 {isCustom && (
 <button 
 onClick={() => removeGoal(goal.id)} 
 className="p-2 text-theme-text-sec hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
 title="Delete custom goal"
 >
 <Trash2 size={16} />
 </button>
 )}
 <button 
 onClick={async () => { try { await toggleGoalActive(goal.id, true); } catch(e: any) { alert(e.message || "Failed to update goal"); } }} 
 className="px-4 py-1.5 bg-theme-card border border-theme-border border-dashed/80 hover:border-theme-text hover:text-theme-bg hover:bg-theme-text text-theme-text-sec font-medium text-sm rounded-full transition-all shadow-sm"
 >
 Add
 </button>
 </div>
 </div>
 )})}
 </>
 )}
 </div>
 </>
 );
 })()}
 </div>
 </div>
 )}
 </div>

 {/* Right Col: Weight & BMI */}
 <div className="space-y-6">
 <div className="bg-theme-card p-6 rounded-3xl border border-theme-border border-dashedshadow-sm">
 <div className="flex justify-between items-center mb-6">
 <div>
 <h3 className="text-xl font-sans font-medium text-theme-text">Weight Trends</h3>
 <p className="text-sm text-theme-text-sec mt-1">Track your weight and BMI.</p>
 </div>
 <button 
 onClick={() => setShowWeightModal(true)}
 className="p-2 sm:px-3 sm:py-1.5 flex items-center justify-center gap-2 bg-theme-card border border-theme-border border-dashedtext-theme-text hover:bg-theme-card-sec rounded-lg text-xs font-bold transition-colors"
 title="Log Weight"
 >
 <Plus size={16} />
 <span className="hidden sm:inline">Log</span>
 </button>
 </div>

 <div className="h-[250px] w-full">
 {sortedWeightData.length > 0 ? (
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={sortedWeightData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
 <defs>
 <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
 <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-theme-border)" />
 <XAxis 
 dataKey="timestamp" 
 type="number"
 scale="time"
 domain={['dataMin', 'dataMax']}
 tickFormatter={(t) => safeFormat(new Date(t), 'MMM d')} 
 axisLine={false} 
 tickLine={false} 
 tick={{ fontSize: 12, fill: 'var(--color-theme-text-sec)' }} 
 dy={10} 
 />
 <YAxis 
 domain={[(dataMin: number) => Math.floor(dataMin - 2), (dataMax: number) => Math.ceil(dataMax + 2)]} 
 axisLine={false} 
 tickLine={false} 
 tickCount={5}
 allowDecimals={false}
 width={40}
 tick={{ fontSize: 12, fill: 'var(--color-theme-text-sec)' }} 
 />
 <Tooltip 
 content={({ active, payload, label }) => {
 if (active && payload && payload.length) {
 const data = payload[0].payload;
 return (
 <div className="bg-theme-card p-3 rounded-xl shadow-lg border border-theme-border border-dashed">
 <p className="text-xs text-theme-text-sec mb-1">{data.fullDateTime || safeFormat(new Date(label), 'MMM d, yyyy')}</p>
 <p className="text-sm font-bold text-theme-text">Weight: {payload[0].value} kg</p>
 </div>
 );
 }
 return null;
 }}
 />
 <Area type="monotone" name="Weight (kg)" dataKey="weight" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" dot={{ r: 4, strokeWidth: 2, fill: "var(--color-theme-card)" }} activeDot={{ r: 6, fill: "#10b981", stroke: "var(--color-theme-card)", strokeWidth: 2 }} />
 </AreaChart>
 </ResponsiveContainer>
 ) : (
 <div className="h-full flex flex-col items-center justify-center text-theme-text-sec">
 <Target size={32} className="opacity-20 mb-2" />
 <p>No weight data logged</p>
 </div>
 )}
 </div>
 
 {sortedWeightData.length > 0 && (
 <div className="mt-6 pt-6 border-t border-theme-border w-full flex flex-col">
 <div className="flex items-center justify-between">
 <h4 className="text-xl font-sans font-medium text-theme-text">BMI Trends</h4>
 {latestBmi && latestBmiCls && (
 <div className="flex items-center gap-2">
 <span className="text-sm font-bold text-theme-text">Latest: {latestBmi.toFixed(1)}</span>
 <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold ", latestBmiCls.bg, latestBmiCls.color)}>
 {latestBmiCls.label}
 </span>
 </div>
 )}
 </div>
 <p className="text-[10px] text-theme-text-sec mb-4 leading-tight max-w-sm mt-1">
 Note: BMI is a general indicator and may not be accurate for athletes, pregnant women, or bodybuilders. Please consider other methods for comprehensive weight health.
 </p>
 <div className="h-[250px] w-full">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={bmiData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
 <defs>
 <linearGradient id="colorBmi" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
 <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-theme-border)" />
 <XAxis 
 dataKey="timestamp" 
 type="number"
 scale="time"
 domain={['dataMin', 'dataMax']}
 tickFormatter={(t) => safeFormat(new Date(t), 'MMM d')} 
 axisLine={false} 
 tickLine={false} 
 tick={{ fontSize: 12, fill: 'var(--color-theme-text-sec)' }} 
 dy={10} 
 />
 <YAxis 
 domain={[(dataMin: number) => Math.floor(dataMin - 2), (dataMax: number) => Math.ceil(dataMax + 2)]} 
 axisLine={false} 
 tickLine={false} 
 tickCount={5}
 allowDecimals={false}
 width={40}
 tick={{ fontSize: 12, fill: 'var(--color-theme-text-sec)' }} 
 />
 <Tooltip 
 content={({ active, payload, label }) => {
 if (active && payload && payload.length) {
 const data = payload[0].payload;
 const bmi = payload[0].value as number;
 const cls = getBmiClassification(bmi);
 return (
 <div className="bg-theme-card p-3 rounded-xl shadow-lg border border-theme-border border-dashed">
 <p className="text-xs text-theme-text-sec mb-1">{data.fullDateTime || safeFormat(new Date(label), 'MMM d, yyyy')}</p>
 <div className="flex items-center gap-2">
 <p className="text-sm font-bold text-theme-text">BMI: {bmi.toFixed(1)}</p>
 <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold ", cls.bg, cls.color)}>
 {cls.label}
 </span>
 </div>
 </div>
 );
 }
 return null;
 }}
 />
 <Area type="monotone" name="BMI" dataKey="bmi" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorBmi)" dot={{ r: 4, strokeWidth: 2, fill: "var(--color-theme-card)" }} activeDot={{ r: 6, fill: "#6366f1", stroke: "var(--color-theme-card)", strokeWidth: 2 }} />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>
 )}
 </div>
 </div>

 </div>

 {showWeightModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
 <div className="bg-theme-card rounded-3xl w-full max-w-sm shadow-2xl p-6 animate-in zoom-in-95 duration-200">
 <h3 className="text-xl font-bold text-theme-text mb-6">Log Weight</h3>
 <form onSubmit={handleLogWeight} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-theme-text mb-1">Weight (kg)</label>
 <input 
 type="number" step="0.1" min="0"
 value={newWeight} onChange={e => setNewWeight(e.target.value)}
 autoFocus required
 className="w-full text-2xl px-4 py-3 bg-theme-card-sec border border-theme-border border-dashedrounded-xl focus:ring-2 focus:ring-theme-accent outline-none transition-all"
 placeholder="0.0"
 />
 </div>
 <div className="flex gap-3 pt-4">
 <button type="button" onClick={() => setShowWeightModal(false)} className="flex-1 py-3 px-4 bg-theme-card-sec text-theme-text rounded-xl font-medium hover:bg-theme-border transition-colors">Cancel</button>
 <button type="submit" disabled={!newWeight || isSubmittingWeight} className="flex-1 py-3 px-4 bg-theme-accent text-white disabled:opacity-50 text-white rounded-xl font-medium hover:bg-theme-accent/90 transition-colors shadow-sm">Save</button>
 </div>
 </form>
 </div>
 </div>
 )}

 {showCustomGoalModal && (
 <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
 <div className="bg-theme-card rounded-3xl w-full max-w-sm shadow-2xl p-6 animate-in zoom-in-95 duration-200">
 <h3 className="text-xl font-bold text-theme-text mb-4">New Custom Goal</h3>
 <form onSubmit={handleCreateCustomGoal} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-theme-text mb-1">Goal Name</label>
 <input 
 type="text" value={customGoalData.title} onChange={e => setCustomGoalData(s => ({...s, title: e.target.value}))}
 required autoFocus placeholder="e.g. Drink Matcha"
 className="w-full px-4 py-3 bg-theme-card-sec border border-theme-border border-dashedrounded-xl focus:ring-2 focus:ring-theme-accent outline-none"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-theme-text mb-1">Tracking Type</label>
 <select 
 value={customGoalData.targetType} onChange={e => setCustomGoalData(s => ({...s, targetType: e.target.value as any}))}
 className="w-full px-4 py-3 bg-theme-card-sec border border-theme-border border-dashedrounded-xl focus:ring-2 focus:ring-theme-accent outline-none"
 >
 <option value="checkbox">Simple Checkbox</option>
 <option value="number">Numeric Target</option>
 </select>
 </div>
 {customGoalData.targetType === 'number' && (
 <div className="flex gap-3">
 <div className="flex-1">
 <label className="block text-sm font-medium text-theme-text mb-1">Target</label>
 <input type="number" step="0.1" value={customGoalData.targetValue} onChange={e => setCustomGoalData(s => ({...s, targetValue: e.target.value}))} required className="w-full px-4 py-2 bg-theme-card-sec border border-theme-border border-dashedrounded-xl outline-none" />
 </div>
 <div className="flex-1">
 <label className="block text-sm font-medium text-theme-text mb-1">Unit</label>
 <input type="text" value={customGoalData.unit} onChange={e => setCustomGoalData(s => ({...s, unit: e.target.value}))} placeholder="e.g. cups" className="w-full px-4 py-2 bg-theme-card-sec border border-theme-border border-dashedrounded-xl outline-none" />
 </div>
 </div>
 )}
 <div className="flex gap-3 pt-4">
 <button type="button" onClick={() => setShowCustomGoalModal(false)} className="flex-1 py-3 px-4 bg-theme-card-sec text-theme-text rounded-xl font-medium hover:bg-theme-border transition-colors">Cancel</button>
 <button type="submit" disabled={!customGoalData.title} className="flex-1 py-3 px-4 bg-theme-accent text-white disabled:opacity-50 text-white rounded-xl font-medium hover:bg-theme-accent/90 transition-colors shadow-sm">Create</button>
 </div>
 </form>
 </div>
 </div>
 )}

 {showRecommendationsModal && recommendationPlan && (
 <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md transition-opacity overflow-y-auto">
 <div className="bg-theme-card rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
 <div className="relative p-6 sm:p-8 bg-gradient-to-br from-purple-600 to-indigo-700 text-white">
 <button onClick={() => setShowRecommendationsModal(false)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
 <X size={20} />
 </button>
 <h3 className="text-2xl font-display font-medium flex items-center gap-2 mb-4">
 <Asterisk className="text-purple-200 animate-[spin_8s_linear_infinite]" />
 Weekly Recommendations
 </h3>
 <p className="text-purple-100 text-[15px] leading-relaxed">
 {recommendationPlan.summary}
 </p>
 </div>
 
 <div className="p-6 sm:p-8 max-h-[50vh] overflow-y-auto">
 <h4 className="text-xs font-bold text-theme-text-sec mb-4">Recommended Goals</h4>
 <div className="space-y-3">
 {recommendationPlan.goals.map((g: any) => (
 <label key={g.id} className={cn("flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-md", g.selected ? "border-purple-500 bg-purple-500/5" : "border-theme-border bg-theme-bg")}>
 <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 mt-0.5 transition-colors", g.selected ? "bg-purple-600 border-purple-600 text-white" : "border-theme-border text-transparent")}>
 <Check className={cn("w-4 h-4 transition-opacity", g.selected ? "opacity-100" : "opacity-0")} />
 </div>
 <div>
 <p className={cn("font-bold", g.selected ? "text-theme-text" : "text-theme-text-sec")}>{g.title}</p>
 <p className="text-xs font-medium text-theme-text-sec mt-1 ">{g.category}</p>
 </div>
 <input type="checkbox" className="hidden" checked={g.selected} onChange={() => toggleRecSelected(g.id)} />
 </label>
 ))}
 </div>
 </div>

 <div className="p-6 sm:p-8 pt-0 border-t border-theme-border/50 bg-theme-card flex flex-col sm:flex-row gap-3">
 <button onClick={() => handleAcceptRecommendations(true)} className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg text-sm">
 Accept All
 </button>
 <button onClick={() => handleAcceptRecommendations(false)} disabled={!recommendationPlan.goals.some((g: any) => g.selected)} className="flex-1 py-3 px-4 bg-theme-bg border border-theme-border border-dashedhover:border-purple-500 text-theme-text disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-all text-sm">
 Accept Selected
 </button>
 <button onClick={handleIgnoreRecommendations} className="py-3 px-4 text-theme-text-sec hover:text-theme-text font-bold transition-colors text-sm">
 Ignore
 </button>
 </div>
 </div>
 </div>
 )}
 {showHealthCoachInfo && (
 <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowHealthCoachInfo(false)}>
 <div 
 className="w-full sm:max-w-md bg-theme-bg rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-xl font-display font-medium text-theme-text flex items-center gap-2">
 <Asterisk className="text-purple-500 animate-[spin_8s_linear_infinite]" size={20} />
 Health Coach
 </h3>
 <button onClick={() => setShowHealthCoachInfo(false)} className="w-8 h-8 rounded-full bg-theme-card flex items-center justify-center text-theme-text-sec hover:text-theme-text transition-colors">
 <X size={20} />
 </button>
 </div>
 <p className="text-theme-text font-medium mb-4">
 Personalized using your health data.
 </p>
 <p className="text-theme-text-sec text-sm leading-relaxed">
 The Health Coach analyzes your fitness, glucose levels, and lab reports to recommend customized weekly goals to help you stay on track.
 </p>
 </div>
 </div>
 )}

 </div>
 );
}
