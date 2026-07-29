const fs = require('fs');
let code = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf8');

const target = `    {sortedReports.length === 0 ? (
      <div className="text-center py-12 relative z-10">
        <p className="text-theme-text-sec">No medical reports found.</p>
      </div>
    ) : (
      sortedReports.map((report, i) => (
        <div key={report.id || i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active py-6">`;

const replacement = `    {sortedReports.length === 0 ? (
      <div className="text-center py-12 relative z-10">
        <p className="text-theme-text-sec">No medical reports found.</p>
      </div>
    ) : (
      [...sortedReports].reverse().map((report, i) => (
        <div key={report.id || i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active py-6">`;

if(code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/BiomarkersTab.tsx', code);
  console.log("Fixed BiomarkersTab.tsx");
} else {
  console.log("Target not found in BiomarkersTab.tsx");
}
