const fs = require('fs');
let code = fs.readFileSync('src/components/WeightCard.tsx', 'utf8');

const oldRecentLogs = `<div className="flex flex-col items-end">
                      <span className="text-theme-text-sec">{safeFormat(log.date, 'MMM d, yyyy')}</span>
                      {log.createdAt && <span className="text-[11px] text-theme-text-sec/60">{safeFormat(new Date(log.createdAt), 'h:mm a')}</span>}
                    </div>`;

const newRecentLogs = `<div className="flex flex-col items-end">
                      <span className="text-theme-text-sec">{safeFormat(log.date, 'MMM d, yyyy')}</span>
                      {log.createdAt && typeof log.createdAt === 'number' && <span className="text-[11px] text-theme-text-sec/60">{safeFormat(new Date(log.createdAt), 'h:mm a')}</span>}
                    </div>`;

code = code.replace(oldRecentLogs, newRecentLogs);

const oldHistoryLogs = `<div className="flex flex-col items-end">
                    <span className="text-theme-text-sec text-[13px]">{safeFormat(log.date, 'MMM d, yyyy')}</span>
                    {log.createdAt && <span className="text-[11px] text-theme-text-sec/60">{safeFormat(new Date(log.createdAt), 'h:mm a')}</span>}
                  </div>`;

const newHistoryLogs = `<div className="flex flex-col items-end">
                    <span className="text-theme-text-sec text-[13px]">{safeFormat(log.date, 'MMM d, yyyy')}</span>
                    {log.createdAt && typeof log.createdAt === 'number' && <span className="text-[11px] text-theme-text-sec/60">{safeFormat(new Date(log.createdAt), 'h:mm a')}</span>}
                  </div>`;

code = code.replace(oldHistoryLogs, newHistoryLogs);
fs.writeFileSync('src/components/WeightCard.tsx', code);
