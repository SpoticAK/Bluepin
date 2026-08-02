const fs = require('fs');
let code = fs.readFileSync('src/components/WeightCard.tsx', 'utf8');

const oldTooltip = `                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--theme-card)', borderRadius: '12px', border: '1px solid var(--theme-border)' }}
                    labelStyle={{ color: 'var(--theme-text-sec)', fontSize: '12px', marginBottom: '4px' }}
                    itemStyle={{ color: 'var(--theme-text)', fontSize: '14px', fontWeight: 'bold' }}
                    labelFormatter={(label) => safeFormat(label as string, 'MMM d, yyyy')}
                  />`;

const newTooltip = `                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--theme-card)', borderRadius: '12px', border: '1px solid var(--theme-border)' }}
                    labelStyle={{ color: 'var(--theme-text-sec)', fontSize: '12px', marginBottom: '4px' }}
                    itemStyle={{ color: 'var(--theme-text)', fontSize: '14px', fontWeight: 'bold' }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload.length > 0 && payload[0].payload.createdAt) {
                        return safeFormat(new Date(payload[0].payload.createdAt), 'h:mm a');
                      }
                      return safeFormat(label as string, 'MMM d, yyyy');
                    }}
                  />`;

code = code.replace(oldTooltip, newTooltip);
fs.writeFileSync('src/components/WeightCard.tsx', code);
