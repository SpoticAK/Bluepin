const fs = require('fs');
let code = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf8');

const targetStr = ` const generateInsights = async () => {
    console.log("generateInsights");
 };`;

const replaceStr = ` const generateInsights = async () => {
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
       headers: { 'Authorization': \`Bearer \${await auth.currentUser?.getIdToken()}\`, 'Content-Type': 'application/json' },
       body: JSON.stringify({ reports: simplifiedReports })
     });
     
     if (!res.ok) {
       const text = await res.text();
       let parsed;
       try { parsed = JSON.parse(text); } catch (e) {}
       throw new Error(parsed?.error || text || \`HTTP Error \${res.status}\`);
     }
     
     const data = await res.json();
     setAiInsights(data);
     setIsAiInsightsCollapsed(false);
   } catch (err: any) {
     console.error(err);
     setAiError(err.message || "Failed to generate AI highlights.");
   } finally {
     setIsAnalyzing(false);
   }
 };`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/components/BiomarkersTab.tsx', code);
  console.log('Successfully updated generateInsights');
} else {
  console.log('Could not find target string to replace.');
}
