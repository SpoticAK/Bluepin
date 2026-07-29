const fs = require('fs');
let code = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf8');

const targetStrGood = `{aiInsights.good.map((insight, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-theme-text-sec">
                            <span className="leading-relaxed">{typeof insight === "object" ? (insight.text || JSON.stringify(insight)) : String(insight)}</span>
                          </li>
                        ))}`;

const replaceStrGood = `{aiInsights.good.map((insight, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-theme-text-sec">
                            <ProfileLogo profile={insight.profile} />
                            <span className="leading-relaxed">{typeof insight === "object" ? (insight.text || JSON.stringify(insight)) : String(insight)}</span>
                          </li>
                        ))}`;

const targetStrConcern = `{aiInsights.concern.map((insight, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-theme-text-sec">
                            <span className="leading-relaxed">{typeof insight === "object" ? (insight.text || JSON.stringify(insight)) : String(insight)}</span>
                          </li>
                        ))}`;

const replaceStrConcern = `{aiInsights.concern.map((insight, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-theme-text-sec">
                            <ProfileLogo profile={insight.profile} />
                            <span className="leading-relaxed">{typeof insight === "object" ? (insight.text || JSON.stringify(insight)) : String(insight)}</span>
                          </li>
                        ))}`;

if (code.includes(targetStrGood)) {
  code = code.replace(targetStrGood, replaceStrGood);
} else {
  console.log("Good missing");
}

if (code.includes(targetStrConcern)) {
  code = code.replace(targetStrConcern, replaceStrConcern);
} else {
  console.log("Concern missing");
}

fs.writeFileSync('src/components/BiomarkersTab.tsx', code);
console.log('Fixed logos');
