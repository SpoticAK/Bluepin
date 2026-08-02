const fs = require('fs');
let code = fs.readFileSync('src/components/WeightCard.tsx', 'utf8');

const oldTooltip = `<Tooltip 
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

const customTooltipCode = `                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-theme-card border border-theme-border rounded-xl p-3 shadow-lg">
                            <div className="text-theme-text-sec text-xs font-medium mb-1">
                              {data.createdAt ? safeFormat(new Date(data.createdAt), 'h:mm a') : safeFormat(data.date, 'MMM d, yyyy')}
                            </div>
                            <div className="text-theme-text font-bold text-sm">
                              {data.weight} kg
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />`;

if (code.includes('labelFormatter={(label, payload)')) {
  code = code.replace(oldTooltip, customTooltipCode);
  fs.writeFileSync('src/components/WeightCard.tsx', code);
  console.log('Successfully replaced tooltip');
} else {
  console.log('Could not find oldTooltip');
}
