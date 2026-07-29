const fs = require('fs');
let code = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf8');

const targetStr = `           <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] bg-theme-card border border-theme-border p-5 rounded-3xl shadow-sm hover:shadow-md transition-all group-hover:-translate-y-1 relative z-10">
             <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
               <div>
                 <div className="flex items-center gap-2 mb-1">
                   <p className="text-sm font-bold text-theme-text-sec">{report.date}</p>
                   <button 
                     onClick={() => setEditDateReport({ id: report.id, date: report.date })}
                     className="text-theme-accent hover:opacity-80 text-xs font-bold px-2 py-0.5 bg-theme-accent/10 rounded-full"
                   >
                     Edit Date
                   </button>
                 </div>
                 <h4 className="text-lg font-bold text-theme-text leading-tight">{report.name || 'Lab Report'}</h4>
               </div>
               
               {getReportHealthScore(report).score && (
                 <div className="flex flex-col items-center sm:items-end shrink-0">
                   <p className="text-[10px] uppercase font-bold tracking-wider text-theme-text-sec mb-0.5">Health Score</p>
                   <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 text-white px-4 py-2 rounded-2xl shadow-sm">
                     <span className="text-2xl font-black">{getReportHealthScore(report).score}</span>
                     <span className="text-emerald-100 text-xs ml-1 font-bold">/100</span>
                   </div>
                 </div>
               )}
             </div>
             
             <div className="flex items-center gap-2 mt-5">
               {report.fileUrl && report.fileUrl !== '#' && (
                 <button 
                   onClick={() => handleDownloadFile(report.fileUrl, report.date)}
                   className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-theme-bg hover:bg-theme-border border border-theme-border rounded-xl text-sm font-bold transition-colors text-theme-text"
                 >
                   <Download size={16} /> Download
                 </button>
               )}
               <button 
                 onClick={() => setDeleteConfirmationId(report.id)}
                 className="flex items-center justify-center p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl transition-colors shrink-0"
                 title="Delete Report"
               >
                 <X size={16} />
               </button>
             </div>
           </div>`;

const replaceStr = `           <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] bg-theme-card border border-theme-border p-6 rounded-[32px] shadow-xl hover:border-theme-text/20 transition-all group-hover:-translate-y-1 relative z-10 overflow-hidden">
             {getReportHealthScore(report).score && (
               <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-[100px] -z-10 blur-2xl pointer-events-none" />
             )}
             
             <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 relative z-10">
               <div className="flex-1">
                 <div className="flex items-center gap-3 mb-2">
                   <span className="px-3 py-1 bg-theme-bg rounded-full text-xs font-bold tracking-wide text-theme-text-sec uppercase border border-theme-border">
                     {report.date}
                   </span>
                   <button 
                     onClick={() => setEditDateReport({ id: report.id, date: report.date })}
                     className="text-theme-text-sec hover:text-theme-text text-xs font-bold underline decoration-theme-border underline-offset-4"
                   >
                     Edit
                   </button>
                 </div>
                 <h4 className="text-xl sm:text-2xl font-black text-theme-text leading-tight tracking-tight mt-1">{report.name || 'Lab Report'}</h4>
               </div>
               
               {getReportHealthScore(report).score && (
                 <div className="flex flex-col items-start sm:items-end shrink-0">
                   <p className="text-[10px] uppercase font-bold tracking-widest text-theme-text-sec mb-1">Health Score</p>
                   <div className="flex items-baseline gap-1">
                     <span className="text-5xl font-black tracking-tighter text-theme-text">{getReportHealthScore(report).score}</span>
                     <span className="text-theme-text-sec font-bold">/100</span>
                   </div>
                 </div>
               )}
             </div>
             
             <div className="flex items-center gap-3 mt-8 pt-6 border-t border-theme-border/50">
               {report.fileUrl && report.fileUrl !== '#' && (
                 <button 
                   onClick={() => handleDownloadFile(report.fileUrl, report.date)}
                   className="flex-1 flex items-center justify-center gap-2 py-3 bg-theme-text hover:opacity-90 text-theme-bg rounded-2xl text-sm font-bold transition-opacity"
                 >
                   <Download size={18} /> Download Report
                 </button>
               )}
               <button 
                 onClick={() => setDeleteConfirmationId(report.id)}
                 className="flex items-center justify-center p-3 bg-theme-bg hover:bg-theme-border text-theme-critical border border-theme-border rounded-2xl transition-colors shrink-0"
                 title="Delete Report"
               >
                 <X size={18} />
               </button>
             </div>
           </div>`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('src/components/BiomarkersTab.tsx', code);
  console.log("Timeline Cards updated to Whoop style!");
} else {
  console.log("Target not found!");
}
