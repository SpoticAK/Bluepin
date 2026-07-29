/**
 * Bluepin Care Reminder Engine
 * Returns ALL active reminders for one person. The UI decides how many to display.
 */
export type GlucoseTiming = "Fasting"|"Post-Prandial"|"Random";
export interface GlucoseReading { timestamp:string; timing?:GlucoseTiming; }
export interface CareReminderInput {
  now?:Date; healthScore?:number|null; glucoseTrackingEnabled?:boolean;
  glucoseReadings?:GlucoseReading[]; weightLogs?:{timestamp:string}[];
  healthReports?:{uploadedAt:string}[];
}
export interface CareReminder {
  id:string;
  type:"glucose_fasting"|"glucose_post_meal"|"glucose_missed_days"|"glucose_consistency"|"weight"|"health_report";
  title:string; message:string;
  action:"log_glucose"|"log_weight"|"upload_report";
}
export const CARE_RULES = {
  glucose:{ fastingCutoffHour:10, postMealReminderHour:14, consistencyMinimumDays:10, consistencyMarginMinutes:60, inconsistencyThreshold:0.5 },
  weight:{ everyDays:7 },
  healthReport:{ scoreThreshold:80, belowThresholdMonths:6, atOrAboveThresholdMonths:12 }
} as const;

const DAY_MS=86_400_000;
const dayKey=(d:Date)=>`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const daysBetween=(a:Date,b:Date)=>Math.max(0,Math.floor((new Date(b.getFullYear(),b.getMonth(),b.getDate()).getTime()-new Date(a.getFullYear(),a.getMonth(),a.getDate()).getTime())/DAY_MS));
const latestDate=(xs:string[])=>{const t=xs.map(x=>new Date(x).getTime()).filter(Number.isFinite);return t.length?new Date(Math.max(...t)):null};
const addMonths=(d:Date,m:number)=>{const r=new Date(d);r.setMonth(r.getMonth()+m);return r};
const todayReadings=(rs:GlucoseReading[],now:Date)=>rs.filter(r=>dayKey(new Date(r.timestamp))===dayKey(now));

function missedGlucoseDays(rs:GlucoseReading[],now:Date){
  if(!rs.length)return null;
  const pastReadings = rs.filter(r => {
    const d = new Date(r.timestamp);
    return dayKey(d) !== dayKey(now) && d.getTime() < now.getTime();
  });
  if (!pastReadings.length) return null;
  
  const logged=new Set(pastReadings.map(r=>dayKey(new Date(r.timestamp))));
  const cursor=new Date(now.getFullYear(),now.getMonth(),now.getDate()-1);
  let missed=0;
  while(!logged.has(dayKey(cursor))&&missed<365){
    missed++;
    cursor.setDate(cursor.getDate()-1);
  }
  return missed === 365 ? null : missed;
}

function inconsistentGlucoseTiming(rs:GlucoseReading[]){
  const groups=[
    rs.filter(r=>r.timing==="Fasting"),
    rs.filter(r=>r.timing==="Post-Prandial")
  ];
  const group=groups.find(g=>new Set(g.map(r=>dayKey(new Date(r.timestamp)))).size>=CARE_RULES.glucose.consistencyMinimumDays);
  if(!group)return false;
  const perDay=new Map<string,Date>();
  group.forEach(r=>{const d=new Date(r.timestamp),k=dayKey(d);if(!perDay.has(k))perDay.set(k,d)});
  const times=[...perDay.values()].map(d=>d.getHours()*60+d.getMinutes());
  const avg=times.reduce((a,b)=>a+b,0)/times.length;
  const outside=times.filter(t=>Math.abs(t-avg)>CARE_RULES.glucose.consistencyMarginMinutes).length;
  return outside/times.length>CARE_RULES.glucose.inconsistencyThreshold;
}

function glucoseReminders(input:CareReminderInput,now:Date):CareReminder[]{
  if(!input.glucoseTrackingEnabled)return [];
  const rs=input.glucoseReadings??[], today=todayReadings(rs,now), hour=now.getHours(), out:CareReminder[]=[];
  const fasting=today.some(r=>r.timing==="Fasting");
  const postMeal=today.some(r=>r.timing==="Post-Prandial");

  if(!fasting) out.push({
    id:"glucose-fasting", type:"glucose_fasting",
    title:hour<CARE_RULES.glucose.fastingCutoffHour?"Log your fasting glucose":"Fasting glucose missed today",
    message:hour<CARE_RULES.glucose.fastingCutoffHour?"Log your glucose before breakfast.":"Remember to log it before breakfast tomorrow.",
    action:"log_glucose"
  });

  if(!postMeal&&hour>=CARE_RULES.glucose.postMealReminderHour) out.push({
    id:"glucose-post-meal", type:"glucose_post_meal",
    title:"Log your post-meal glucose", message:"Log a reading after lunch or dinner.", action:"log_glucose"
  });

  const missed=missedGlucoseDays(rs,now);
  if(missed===null) {
    if (!rs.length) {
      out.push({
        id:"glucose-missed-days", type:"glucose_missed_days",
        title:"Start tracking your glucose", message:"You have not logged a glucose reading yet.", action:"log_glucose"
      });
    }
  } else if(missed>0 && !today.length) { out.push({
    id:"glucose-missed-days", type:"glucose_missed_days",
    title:"Glucose logging missed", message:`You missed ${missed} ${missed===1?"day":"days"} of glucose logging.`, action:"log_glucose"
  });
  }

  if(inconsistentGlucoseTiming(rs) && !today.length) out.push({
    id:"glucose-consistency", type:"glucose_consistency",
    title:"Keep your glucose logging time consistent",
    message:"Try to log comparable glucose readings at around the same time each day.", action:"log_glucose"
  });
  return out;
}

function weightReminders(input:CareReminderInput,now:Date):CareReminder[]{
  if(input.weightLogs===undefined)return [];
  const latest=latestDate(input.weightLogs.map(w=>w.timestamp));
  if(!latest)return [{id:"weight",type:"weight",title:"Log your weight",message:"You have not logged your weight yet.",action:"log_weight"}];
  const since=daysBetween(latest,now);
  if(since<=CARE_RULES.weight.everyDays)return [];
  const overdue=since-CARE_RULES.weight.everyDays;
  return [{id:"weight",type:"weight",title:"Update your weekly weight",message:`Your weight logging is ${overdue} ${overdue===1?"day":"days"} overdue.`,action:"log_weight"}];
}

function reportReminders(input:CareReminderInput,now:Date):CareReminder[]{
  if(input.healthReports===undefined)return [];
  const latest=latestDate(input.healthReports.map(r=>r.uploadedAt));
  if(!latest)return [{id:"health-report",type:"health_report",title:"Upload your health report",message:"You have not uploaded a health report.",action:"upload_report"}];
  const months=typeof input.healthScore==="number"&&input.healthScore<CARE_RULES.healthReport.scoreThreshold
    ?CARE_RULES.healthReport.belowThresholdMonths:CARE_RULES.healthReport.atOrAboveThresholdMonths;
  if(now<addMonths(latest,months))return [];
  return [{id:"health-report",type:"health_report",title:"Update your health report",
    message:months===6?"It has been more than 6 months since your last health report.":"It has been more than a year since your last health report.",
    action:"upload_report"}];
}

/** Evaluates every rule independently and returns ALL active reminders. */
export function getCareReminders(input:CareReminderInput):CareReminder[]{
  const now=input.now??new Date();
  return [...glucoseReminders(input,now),...weightReminders(input,now),...reportReminders(input,now)];
}
export default getCareReminders;
