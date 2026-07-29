import { ActivityCircle, emojiToStatus } from './ActivityCircle';
import React, { useState, useMemo } from 'react';
import getCareReminders from '../careReminderRules';
import { Loader2, HeartPulse, Target, Sparkles, ChevronRight, Activity, FileText, User, ArrowUp, ArrowDown, ChevronDown, Flame } from 'lucide-react';
import { cn, safeFormat } from '../lib/utils';
import { useAppStore } from '../store';
import { auth } from '../lib/firebase';
import FamilyMemberProfile from './family/FamilyMemberProfile';

import { motion, AnimatePresence } from 'motion/react';

type TabType = 'dashboard' | 'family' | 'glucose' | 'biomarkers' | 'fitness';


export interface FamilyMember { id: string; name: string; avatarColor?: string; photoUrl?: string; healthScore: number; currentStreak: number; recentStreak?: ('completed' | 'partial' | 'missed' | 'none')[]; bmi: number; hba1c?: number; glucoseEnabled?: boolean; latestGlucose?: number; careReminders?: any[]; }
const getBmiInfo = (bmi: number | string | undefined | null) => {
 if (!bmi) return { label: '--', color: 'text-neutral-400' };
 const num = typeof bmi === "number" ? bmi : parseFloat(bmi as string);
 if (isNaN(num)) return { label: '--', color: 'text-neutral-400' };
 
 if (num < 18.5) return { label: 'Underweight', color: 'text-[#C89A4A]' };
 if (num < 23) return { label: 'Normal', color: 'text-[#6F8F7B]' };
 if (num < 25) return { label: 'Overweight', color: 'text-[#C89A4A]' };
 if (num < 30) return { label: 'Obese I', color: 'text-[#C46C5E]' };
 return { label: 'Obese II', color: 'text-[#C46C5E]' };
};

const getHba1cInfo = (hba1c: number | string | undefined | null) => {
 if (!hba1c) return null;
 const num = typeof hba1c === "number" ? hba1c : parseFloat(hba1c as string);
 if (isNaN(num)) return null;
 
 if (num < 5.7) return { label: 'Normal', color: 'text-[#6F8F7B]' };
 if (num <= 6.4) return { label: 'Prediabetes', color: 'text-[#C89A4A]' };
 return { label: 'Diabetes', color: 'text-[#C46C5E]' };
};

import { getHealthScoreTheme } from '../lib/scoreColor';
import { getAdjustedMemberStreak } from '../lib/familyUtils';

const MemberCard: React.FC<{ member: FamilyMember, onClick: () => void, onNavigate?: (tab: any) => void }> = ({ member, onClick, onNavigate }) => {
 const [expandedSection, setExpandedSection] = useState<'highlights' | 'reminders' | null>(null);
 
 const diff = member.prevHealthScore !== undefined ? member.healthScore - member.prevHealthScore : 0;
 const isUp = diff > 0;
 const scoreTheme = getHealthScoreTheme(member.healthScore);
 
 const highlights = member.healthHighlights || member.quickObservations || [];
 const reminders = member.careReminders || [];

 const toggleSection = (section: 'highlights' | 'reminders', e: React.MouseEvent) => {
 e.stopPropagation();
 setExpandedSection(expandedSection === section ? null : section);
 };

 const { recentStreak: streakCircles, currentStreak } = useMemo(() => {
   return getAdjustedMemberStreak(member);
 }, [member.recentStreak, (member as any).updatedAt, member.currentStreak]);

 return (
 <div className="bg-theme-card border border-theme-border/50 border-dashed hover:border-theme-text/20 rounded-3xl p-4 sm:p-4 transition-all hover:shadow-lg hover:shadow-theme-text/5 hover:-translate-y-1 flex flex-col justify-start text-left relative overflow-hidden group/card">
 {/* Subtle Glow */}
 <div className="absolute top-0 right-0 w-64 h-64 bg-theme-text/[0.02] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none transition-all group-hover/card:bg-theme-text/[0.04]"></div>

 {/* Header */}
 <div className="flex justify-between items-center mb-2 cursor-pointer relative z-10" onClick={onClick}>
 <div className="flex items-center gap-3">
 {member.photoUrl ? (
 <img src={member.photoUrl} alt={member.name} className="w-10 h-10 rounded-full border border-theme-bg shadow-sm object-cover" />
 ) : (
 <div 
 className="w-10 h-10 rounded-full border border-white/10 dark:border-white/5 flex items-center justify-center shrink-0 relative overflow-hidden"
 style={{ 
 background: `linear-gradient(135deg, ${member.avatarColor}99 0%, ${member.avatarColor} 100%)`,
 boxShadow: `0 2px 10px -2px ${member.avatarColor}40`
 }}
 >
 <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
 <span className="font-display font-medium text-base text-white/90 relative z-10 ">{member.name.charAt(0)}</span>
 </div>
 )}
 <div className="flex flex-col">
 <h4 className="text-lg font-bold text-theme-text">{member.name}</h4>
 <div className="flex items-center gap-1 mt-0.5">
 <div className="flex items-center gap-1">
 {streakCircles.map((status, idx) => (
                          <ActivityCircle 
                            key={idx}
                            status={status as any}
                            isToday={idx === streakCircles.length - 1}
                            size="xs"
                          />
                        ))}
 </div>
 <span className="text-sm font-bold text-theme-text-sec ml-2 flex items-center gap-1">
 <Flame className="w-4 h-4 text-theme-accent" /> {currentStreak}
 </span>
 </div>
 </div>
 </div>
 <ChevronRight size={18} className="text-theme-text-sec transition-transform group-hover/card:translate-x-1" />
 </div>

 {/* Primary Metric - Health Score */}
 <div className="flex flex-col items-start cursor-pointer relative z-10" onClick={onClick}>
 <div className="relative">
 {/* Earthy radial glow specific to Health Score */}
 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-20 dark:opacity-30" style={{ backgroundColor: scoreTheme.glowColor }}></div>
 
 <p className="text-base font-medium text-theme-text-sec mb-0.5">Health Score</p>
 <div className="flex items-baseline gap-2 relative">
 <p className="text-5xl font-black text-theme-text tracking-tight">{member.healthScore}</p>
 {diff !== 0 && (
 <span className={cn("text-sm font-bold flex items-center", isUp ? "text-theme-success" : "text-theme-critical")}>
 {isUp ? <ArrowUp size={14} className="mr-0.5" /> : <ArrowDown size={14} className="mr-0.5" />}
 {Math.abs(diff)}
 </span>
 )}
 </div>
 </div>
 </div>
 
 {/* Secondary Metrics */}
 <div className="mt-3 mb-0 flex items-start gap-8 cursor-pointer relative z-10" onClick={onClick}>
 {member.bmi && (() => {
 const bmiInfo = getBmiInfo(member.bmi);
 return (
 <div className="flex flex-col">
 <span className="text-[11px] font-medium text-theme-text-sec mb-1">BMI</span>
 <span className="text-xl font-bold text-theme-text">{member.bmi}</span>
 <span className={`text-[13px] font-medium mt-0.5 ${bmiInfo.color}`}>{bmiInfo.label}</span>
 </div>
 );
 })()}

 {member.hba1c ? (() => {
 const hba1cInfo = getHba1cInfo(member.hba1c);
 return (
 <div className="flex flex-col">
 <span className="text-[11px] font-medium text-theme-text-sec mb-1">HbA1c</span>
 <span className="text-xl font-bold text-theme-text">{member.hba1c}%</span>
 {hba1cInfo && <span className={`text-[13px] font-medium mt-0.5 ${hba1cInfo.color}`}>{hba1cInfo.label}</span>}
 </div>
 );
 })() : member.glucoseEnabled && member.latestGlucose ? (
 <div className="flex flex-col">
 <span className="text-[11px] font-medium text-theme-text-sec mb-1">Glucose</span>
 <span className="text-xl font-bold text-theme-text">{member.latestGlucose}</span>
 </div>
 ) : null}
 </div>

 {/* Expandable Sections Container */}
 <div className="mt-3 pt-2 border-t border-theme-border/50 flex flex-col gap-0.5 relative z-10">
 
 {/* Health Highlights */}
 {highlights.length > 0 && (
 <div className="flex flex-col border border-transparent rounded-xl transition-colors">
 <button 
 onClick={(e) => toggleSection('highlights', e)}
 className="flex items-center justify-between w-full group py-1.5"
 >
 <div className="flex items-center gap-3">
 <div className="w-1 h-5 rounded-full bg-[#6F8F7B] shrink-0" />
 <span className="text-sm font-medium text-theme-text">
 {highlights.length} Health {highlights.length === 1 ? 'Highlight' : 'Highlights'}
 </span>
 </div>
 <ChevronDown size={16} className={cn("text-theme-text-sec transition-transform duration-300", expandedSection !== 'highlights' && "-rotate-90")} />
 </button>
 
 <AnimatePresence>
 {expandedSection === 'highlights' && (
 <motion.div 
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 className="overflow-hidden"
 >
 <ul className="mt-1.5 mb-1 space-y-2 pl-6">
 {highlights.map((highlight, idx) => (
 <li key={idx} className="flex items-start gap-3 text-[13px] text-theme-text leading-relaxed relative">
 <span className="absolute left-[-12px] top-[7px] w-[4px] h-[4px] rounded-full bg-[#6F8F7B]/60"></span>
 <span className="font-medium">{highlight}</span>
 </li>
 ))}
 </ul>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 )}

 {/* Care Reminders */}
 {reminders.length > 0 && (
 <div className="flex flex-col border border-transparent rounded-xl transition-colors">
 <button 
 onClick={(e) => toggleSection('reminders', e)}
 className="flex items-center justify-between w-full group py-1.5"
 >
 <div className="flex items-center gap-3">
 <div className="w-1 h-5 rounded-full bg-[#C89A4A] shrink-0" />
 <span className="text-sm font-medium text-theme-text">
 {reminders.length} Care {reminders.length === 1 ? 'Reminder' : 'Reminders'}
 </span>
 </div>
 <ChevronDown size={16} className={cn("text-theme-text-sec transition-transform duration-300", expandedSection !== 'reminders' && "-rotate-90")} />
 </button>
 
 <AnimatePresence>
 {expandedSection === 'reminders' && (
 <motion.div 
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 className="overflow-hidden"
 >
 <div className="mt-2 mb-2 flex flex-col border border-theme-border/20 rounded-[16px] overflow-hidden bg-theme-bg/30">
 {reminders.map((reminder, idx) => (
   <div 
     key={reminder.id || idx} 
     onClick={(e) => {
       e.stopPropagation();
       if (reminder.action === 'log_glucose') onNavigate?.('glucose');
       else if (reminder.action === 'log_weight') onNavigate?.('fitness');
       else if (reminder.action === 'upload_report') onNavigate?.('biomarkers');
     }}
     className={cn(
       "flex items-start justify-between p-3 cursor-pointer hover:bg-theme-bg/60 transition-colors group",
       idx < reminders.length - 1 ? "border-b border-theme-border/20" : ""
     )}
   >
     <div className="flex flex-col pr-3">
       <h3 className="text-[13px] font-semibold text-theme-text leading-tight mb-0.5">{reminder.title}</h3>
       <p className="text-[12px] font-normal text-theme-text-sec/80 leading-snug">{reminder.message}</p>
     </div>
     <ChevronRight size={14} className="text-theme-text-sec/30 group-hover:text-theme-text-sec/60 transition-colors shrink-0 mt-0.5" />
   </div>
 ))}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 )}
 
 </div>
 </div>
 );
};


function FamilyMemberProfileLoader({ summary, onBack }: { summary: any, onBack: () => void }) {
  const { loadMemberDetailedData } = useAppStore();
  const [detailedData, setDetailedData] = useState<any>(null);
  
  React.useEffect(() => {
    let active = true;
    loadMemberDetailedData(summary.userId).then(data => {
      if (active) {
        const latestReportDate = data.labReports && data.labReports.length > 0 
          ? data.labReports[data.labReports.length - 1].date 
          : 'No reports';
          
        const todayStr = safeFormat(new Date(), 'yyyy-MM-dd');
        
        const activeGoals = (data.goals || []).map((g: any) => ({
          name: g.name,
          id: g.id,
          completed: data.goalLogs && data.goalLogs[todayStr] && data.goalLogs[todayStr][g.id]?.completed || false
        }));

        const glucoseHistory = (data.glucoseReadings || []).map((r: any) => ({
          date: r.date,
          value: r.value,
          type: r.timing
        }));
        
        const weightHistory = (data.weightEntries || []).map((w: any) => ({
          date: w.date,
          weight: w.weight,
          bmi: summary.profile?.heightCm ? Number((w.weight / Math.pow(summary.profile.heightCm / 100, 2)).toFixed(1)) : 0
        }));

        const combined = {
          ...summary,
          biomarkers: data.labReports && data.labReports.length > 0 
            ? data.labReports[data.labReports.length - 1].biomarkers || []
            : [],
          labReports: data.labReports || [],
          goals: data.goals || [],
          goalLogs: data.goalLogs || {},
          glucoseHistory,
          weightHistory,
          activeGoals,
          borderlineBiomarkers: [],
          needsAttentionBiomarkers: [],
          quickObservations: summary.quickObservations || [],
          healthHighlights: summary.healthHighlights || [],
          careReminders: summary.careReminders || [],
          latestReportDate
        };
        setDetailedData(combined);
      }
    }).catch(err => {
      console.error(err);
      if (active) setDetailedData(summary);
    });
    return () => { active = false; };
  }, [summary.userId, loadMemberDetailedData, summary]);
  
  if (!detailedData) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-theme-text-sec" size={32} /></div>;
  }
  
  return <FamilyMemberProfile member={detailedData} onBack={onBack} />;
}

export default function FamilyTab({ onNavigate }: { onNavigate: (tab: TabType) => void }) {
  const { family, familySummaries, createFamily, joinFamily, leaveFamily, createInvitation, loadMemberDetailedData, profile } = useAppStore();
  const currentUserId = auth.currentUser?.uid;
  const membersList = Object.values(familySummaries) as any[];
  
  const [showCreateFamily, setShowCreateFamily] = useState(false);
  const [showJoinFamily, setShowJoinFamily] = useState(false);
  const [familyNameInput, setFamilyNameInput] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState('');
  
  const handleCreateFamily = async () => {
    if (familyNameInput.trim()) {
      try {
        await createFamily(familyNameInput.trim());
        setShowCreateFamily(false);
      } catch (e: any) {
        alert(e.message || "Failed to create family");
      }
    }
  };
  
  const handleJoinFamily = async () => {
    if (inviteCodeInput.trim()) {
      try {
        await joinFamily(inviteCodeInput.trim());
        setShowJoinFamily(false);
      } catch (e: any) {
        alert(e.message || "Failed to join family");
      }
    }
  };
  
  const handleInvite = async () => {
    try {
      const code = await createInvitation();
      if (code) {
        setGeneratedInvite(code);
      } else {
        alert("Failed to create invitation");
      }
    } catch(e: any) {
      alert(e.message || "Failed to create invitation");
    }
  };
 const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const selectedMember = membersList.find(m => m.userId === selectedMemberId);
  
  if (selectedMember) {
    return <FamilyMemberProfileLoader summary={selectedMember} onBack={() => setSelectedMemberId(null)} />;
  }
  
  return (
    <div className="w-full max-w-5xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-theme-text mb-1">{family ? family.name : 'Your Family'}</h1>
          <p className="text-sm font-medium text-theme-text-sec">Keep everyone healthy</p>
        </div>
        {family && (
          <div className="flex gap-2">
            <button onClick={handleInvite} className="bg-theme-bg text-theme-text px-4 py-2 rounded-full border border-theme-border text-sm font-bold">
              Invite
            </button>
            <button onClick={async () => { if(window.confirm('Are you sure you want to leave the family?')) { try { await leaveFamily(); alert('Successfully left the family.'); } catch(e) { alert(e.message || 'Failed to leave family'); } } }} className="bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-2 rounded-full border border-red-500/20 text-sm font-bold hover:bg-red-500/20 transition-colors">
              Leave
            </button>
          </div>
        )}
      </div>

      {!family && (
        <div className="bg-theme-card p-6 rounded-[24px] border border-theme-border/50 border-dashed text-center mb-8">
          <p className="text-theme-text font-bold mb-2">You aren't in a family yet</p>
          <p className="text-theme-text-sec text-sm mb-6 max-w-sm mx-auto">Create a family to share health data, goals, and streaks with your loved ones, or join an existing family.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
             <button onClick={() => setShowCreateFamily(true)} className="bg-theme-text text-theme-bg px-6 py-2.5 rounded-full font-bold text-sm">Create Family</button>
             <button onClick={() => setShowJoinFamily(true)} className="bg-theme-bg text-theme-text px-6 py-2.5 rounded-full font-bold text-sm border border-theme-border">Join Family</button>
          </div>
        </div>
      )}
      
      {showCreateFamily && (
        <div className="bg-theme-card p-6 rounded-[24px] border border-theme-border/50 border-dashed text-center mb-8">
           <h3 className="font-bold text-theme-text mb-4">Create a Family</h3>
           <input type="text" placeholder="Family Name" className="w-full max-w-xs bg-theme-bg text-theme-text px-4 py-2 rounded-xl border border-theme-border mb-4 focus:outline-none" value={familyNameInput} onChange={e => setFamilyNameInput(e.target.value)} />
           <div className="flex gap-2 justify-center">
              <button onClick={handleCreateFamily} className="bg-theme-text text-theme-bg px-4 py-2 rounded-full font-bold text-sm">Create</button>
              <button onClick={() => setShowCreateFamily(false)} className="bg-theme-bg text-theme-text-sec px-4 py-2 rounded-full font-bold text-sm border border-theme-border">Cancel</button>
           </div>
        </div>
      )}

      {showJoinFamily && (
        <div className="bg-theme-card p-6 rounded-[24px] border border-theme-border/50 border-dashed text-center mb-8">
           <h3 className="font-bold text-theme-text mb-4">Join a Family</h3>
           <input type="text" placeholder="Invite Code" className="w-full max-w-xs bg-theme-bg text-theme-text px-4 py-2 rounded-xl border border-theme-border mb-4 focus:outline-none" value={inviteCodeInput} onChange={e => setInviteCodeInput(e.target.value)} />
           <div className="flex gap-2 justify-center">
              <button onClick={handleJoinFamily} className="bg-theme-text text-theme-bg px-4 py-2 rounded-full font-bold text-sm">Join</button>
              <button onClick={() => setShowJoinFamily(false)} className="bg-theme-bg text-theme-text-sec px-4 py-2 rounded-full font-bold text-sm border border-theme-border">Cancel</button>
           </div>
        </div>
      )}
      
      {generatedInvite && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-[16px] text-center mb-8">
          <p className="text-emerald-700 dark:text-emerald-400 font-bold mb-2">Invitation Created!</p>
          <p className="text-sm text-theme-text-sec mb-2">Share this code with your family member:</p>
          <div className="font-mono bg-theme-bg px-4 py-2 rounded-lg text-theme-text inline-block font-bold">{generatedInvite}</div>
          <button onClick={() => setGeneratedInvite('')} className="block mx-auto mt-4 text-xs text-theme-text-sec underline">Dismiss</button>
        </div>
      )}

      {family && (
        <div className="space-y-8">
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {membersList.map((member, i) => (
                <MemberCard key={member.userId || i} member={member} onClick={() => setSelectedMemberId(member.userId)} onNavigate={onNavigate} />
              ))}
              {membersList.length === 0 && (
                 <div className="col-span-full text-center py-10 bg-theme-bg/50 rounded-2xl border border-theme-border/50 border-dashed ">
                   <p className="text-theme-text-sec text-sm font-medium">You are the only member in this family right now.</p>
                 </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}