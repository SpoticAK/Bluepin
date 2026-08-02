const fs = require('fs');
let code = fs.readFileSync('src/components/WeightCard.tsx', 'utf8');

const oldTooltipCode = `                            <div className="text-theme-text-sec text-xs font-medium mb-1">
                              {data.createdAt ? safeFormat(new Date(data.createdAt), 'h:mm a') : ''}
                            </div>`;

const newTooltipCode = `                            <div className="text-theme-text-sec text-xs font-medium mb-1">
                              {data.createdAt && typeof data.createdAt === 'number' ? safeFormat(new Date(data.createdAt), 'h:mm a') : ''}
                            </div>`;

code = code.replace(oldTooltipCode, newTooltipCode);
fs.writeFileSync('src/components/WeightCard.tsx', code);
