const fs = require('fs');
let code = fs.readFileSync('src/components/WeightCard.tsx', 'utf8');

const oldRecentLog = `<div key={log.id} className="flex justify-between items-center text-[14px] py-1">
                    <span className="text-theme-text font-medium">{log.weight} kg</span>
                    <span className="text-theme-text-sec">{safeFormat(log.date, 'MMM d, yyyy')}</span>
                  </div>`;

const newRecentLog = `<div key={log.id} className="flex justify-between items-center text-[14px] py-1">
                    <span className="text-theme-text font-medium">{log.weight} kg</span>
                    <div className="flex flex-col items-end">
                      <span className="text-theme-text-sec">{safeFormat(log.date, 'MMM d, yyyy')}</span>
                      {log.createdAt && <span className="text-[11px] text-theme-text-sec/60">{safeFormat(new Date(log.createdAt), 'h:mm a')}</span>}
                    </div>
                  </div>`;

code = code.replace(oldRecentLog, newRecentLog);

const oldHistoryLog = `<div key={log.id} className="flex justify-between items-center text-[14px] border-b border-theme-border/30 pb-3 last:border-0 last:pb-0">
                  <span className="text-theme-text font-medium text-[15px]">{log.weight} kg</span>
                  <span className="text-theme-text-sec text-[13px]">{safeFormat(log.date, 'MMM d, yyyy')}</span>
                </div>`;

const newHistoryLog = `<div key={log.id} className="flex justify-between items-center text-[14px] border-b border-theme-border/30 pb-3 last:border-0 last:pb-0">
                  <span className="text-theme-text font-medium text-[15px]">{log.weight} kg</span>
                  <div className="flex flex-col items-end">
                    <span className="text-theme-text-sec text-[13px]">{safeFormat(log.date, 'MMM d, yyyy')}</span>
                    {log.createdAt && <span className="text-[11px] text-theme-text-sec/60">{safeFormat(new Date(log.createdAt), 'h:mm a')}</span>}
                  </div>
                </div>`;

code = code.replace(oldHistoryLog, newHistoryLog);
fs.writeFileSync('src/components/WeightCard.tsx', code);
