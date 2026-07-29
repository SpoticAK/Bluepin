import { startOfDay, isSameDay, subDays } from 'date-fns';
import { safeFormat } from './utils';
import { DEFAULT_GOALS } from '../data';

export function getActiveGoalsForDate(goals: any[], dateStr: string) {
  return goals.filter(g => {
    if (g.activeHistory && Object.keys(g.activeHistory).length > 0) {
      const historyDates = Object.keys(g.activeHistory).sort();
      let lastState = false;
      let found = false;
      for (const d of historyDates) {
        if (d <= dateStr) {
          lastState = g.activeHistory[d];
          found = true;
        } else {
          break;
        }
      }
      if (found) return lastState;
      const defaultGoal = DEFAULT_GOALS.find(dg => dg.id === g.id);
      if (defaultGoal) return defaultGoal.isActive;
      return false;
    }
    
    if (g.createdAt) {
      let createdDate = new Date();
      if (typeof g.createdAt === 'number') createdDate = new Date(g.createdAt);
      else if (g.createdAt?.toDate) createdDate = g.createdAt.toDate();
      const createdDateStr = safeFormat(createdDate, 'yyyy-MM-dd');
      
      if (dateStr < createdDateStr) {
         const defaultGoal = DEFAULT_GOALS.find(dg => dg.id === g.id);
         if (defaultGoal) return defaultGoal.isActive;
         return false;
      }
    }
    return g.isActive;
  });
}

export function calculateGoalsStreak(goals: any[], goalLogs: any, streakOffset: number = 0) {
  const today = startOfDay(new Date());
  
  if (!goalLogs || Object.keys(goalLogs).length === 0) {
    const defaultWeek = [];
    for (let i = 6; i >= 0; i--) {
       const d = subDays(today, i);
       defaultWeek.push({
         date: d,
         dStr: safeFormat(d, 'yyyy-MM-dd'),
         isToday: isSameDay(d, today),
         emoji: '⚪',
         isBreak: false
       });
    }
    return { 
       currentStreak: 0, 
       highestStreak: 0, 
       streakDays: defaultWeek, 
       currentPartials: 0, 
       canGoBack: false, 
       canGoForward: false,
       weekActivity: defaultWeek
    };
  }

  const sortedDates = Object.keys(goalLogs).sort();
  const firstDateStr = sortedDates[0];
  let curr = startOfDay(new Date()); 
  try { curr = startOfDay(new Date(firstDateStr)); } catch {}
  if (curr > today) curr = today;

  let streak = 0;
  let highestStreak = 0;
  let partialsInARow = 0;
  
  const history: Record<string, string> = {};
  const historyIsBreak: Record<string, boolean> = {};
  
  let loopCurr = curr;
  while (loopCurr <= today) {
    const dStr = safeFormat(loopCurr, 'yyyy-MM-dd');
    const actGoals = getActiveGoalsForDate(goals, dStr);
    const activeCount = actGoals.length;
    const logs = goalLogs[dStr];
    const completedCount = logs 
      ? Object.entries(logs).filter(([gid, l]: [string, any]) => l.completed && actGoals.some(g => g.id === gid)).length 
      : 0;
      
    let emoji = '⚪';
    if (activeCount === 0) {
      emoji = '⚪';
    } else if (completedCount === 0) {
      emoji = isSameDay(loopCurr, today) ? '⚪' : '❌';
    } else if (completedCount >= activeCount) {
      emoji = '🔥';
    } else {
      emoji = '🙌';
    }
    
    history[dStr] = emoji;
    let isBreak = false;
    if (emoji === '❌') {
      streak = 0;
      partialsInARow = 0;
      isBreak = true;
    } else if (emoji === '🔥') {
      streak++;
      partialsInARow = 0;
    } else if (emoji === '🙌') {
      partialsInARow++;
      if (partialsInARow >= 4) {
        streak = 0;
        partialsInARow = 0;
        isBreak = true;
      } else {
        streak++;
      }
    }
    
    highestStreak = Math.max(highestStreak, streak);
    historyIsBreak[dStr] = isBreak;
    
    const nextDate = new Date(loopCurr);
    nextDate.setDate(nextDate.getDate() + 1);
    loopCurr = nextDate;
  }

  const weekActivity = [];
  for (let i = 6; i >= 0; i--) {
    const d = subDays(today, i);
    const dStr = safeFormat(d, 'yyyy-MM-dd');
    let emoji = history[dStr];
    if (!emoji) {
      const actGoals = getActiveGoalsForDate(goals, dStr);
      if (actGoals.length === 0) emoji = '⚪';
      else if (isSameDay(d, today)) emoji = '⚪';
      else emoji = '❌';
    }
    weekActivity.push({
      date: d,
      dStr,
      isToday: isSameDay(d, today),
      emoji,
      isBreak: historyIsBreak[dStr] || false
    });
  }

  // Pagination logic for streakDays
  const recentDays = [];
  const maxDaysToShow = 7;
  const totalDaysSinceStart = Math.max(7, Math.floor((today.getTime() - curr.getTime()) / (1000 * 3600 * 24)));
  
  const startIdx = streakOffset;
  const endIdx = startIdx + maxDaysToShow - 1;
  for (let i = endIdx; i >= startIdx; i--) {
    const d = subDays(today, i);
    const dStr = safeFormat(d, 'yyyy-MM-dd');
    let emoji = history[dStr];
    if (!emoji) {
      const actGoals = getActiveGoalsForDate(goals, dStr);
      if (actGoals.length === 0) emoji = '⚪';
      else if (isSameDay(d, today)) emoji = '⚪';
      else emoji = '❌';
    }
    recentDays.push({ dStr, date: d, emoji, isBreak: historyIsBreak[dStr] || false });
  }

  return { 
     currentStreak: streak, 
     highestStreak, 
     streakDays: recentDays, 
     currentPartials: partialsInARow,
    canGoBack: endIdx < totalDaysSinceStart,
    canGoForward: streakOffset > 0,
    weekActivity
  };
}

export function getWeeklyActivity(goals: any[], goalLogs: any) {
  const { weekActivity } = calculateGoalsStreak(goals, goalLogs);
  return weekActivity;
}
