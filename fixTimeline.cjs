const fs = require('fs');
let code = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf8');

const targetStr = ` {/* Delete Confirmation Modal */}`;

const replaceStr = ` {/* Timeline Content */}
 {activeTab === 'timeline' && (
   <div className="space-y-6 animate-in fade-in duration-300 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-theme-border before:to-transparent">
     {sortedReports.length === 0 ? (
       <div className="text-center py-12 relative z-10">
         <p className="text-theme-text-sec">No medical reports found.</p>
       </div>
     ) : (
       sortedReports.map((report, i) => (
         <div key={report.id || i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active py-6">
           <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-theme-card bg-theme-bg text-theme-text-sec shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 group-hover:text-theme-text group-hover:border-theme-border transition-colors relative z-10">
             <FileText size={16} />
           </div>
           
           <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] bg-theme-card border border-theme-border border-dashed p-4 rounded-2xl shadow-sm hover:shadow-md transition-all group-hover:-translate-y-1 relative z-10">
             <div className="flex justify-between items-start mb-2">
               <div>
                 <p className="text-xs font-bold text-theme-text-sec mb-1">{report.date}</p>
                 <h4 className="font-bold text-theme-text leading-tight">{report.name || 'Lab Report'}</h4>
               </div>
               {getReportHealthScore(report).score && (
                 <div className="bg-theme-bg px-2 py-1 rounded-lg border border-theme-border border-dashed text-xs font-bold">
                   Score: {getReportHealthScore(report).score}
                 </div>
               )}
             </div>
             
             {report.fileUrl && report.fileUrl !== '#' && (
               <button 
                 onClick={() => {
                   if (report.fileUrl) {
                     handleDownloadFile(report.fileUrl, report.date);
                   }
                 }}
                 className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-theme-bg hover:bg-theme-border border border-theme-border border-dashed rounded-xl text-sm font-bold transition-colors text-theme-text"
               >
                 <Download size={14} /> Download PDF
               </button>
             )}
           </div>
         </div>
       ))
     )}
   </div>
 )}

 {/* Delete Confirmation Modal */}`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/components/BiomarkersTab.tsx', code);
  console.log('Successfully added timeline content.');
} else {
  console.log('Could not find target string to replace timeline.');
}
