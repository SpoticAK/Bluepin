const fs = require('fs');
let code = fs.readFileSync('src/store.tsx', 'utf8');

code = code.replace(/import \{ buildFamilySummary \} from "\.\/lib\/familyUtils";\n/g, '');
code = code.replace(/,\s*Family,\s*FamilySummary/g, '');
code = code.replace(/createFamily: \(name: string\) => Promise<void>;\n/g, '');
code = code.replace(/joinFamily: \(invitationId: string\) => Promise<void>;\n/g, '');
code = code.replace(/leaveFamily: \(\) => Promise<void>;\n/g, '');
code = code.replace(/createInvitation: \(\) => Promise<string \| null>;\n/g, '');
code = code.replace(/loadMemberDetailedData: \(memberId: string\) => Promise<any>;\n/g, '');

const block1Regex = /useEffect\(\(\) => \{\n\s*if \(\!auth\.currentUser\) return;\n\s*const uid = auth\.currentUser\.uid;\n\s*const s = stateRef\.current;\n\s*if \(\!s\.profile\.familyId\) return;\s*const newSummary = buildFamilySummary\(s\);[\s\S]*?\}, \[state\.glucoseReadings, state\.labReports, state\.weightEntries, state\.goals, state\.goalLogs, state\.profile\.name, state\.profile\.profileColor, state\.profile\.photoUrl, state\.profile\.glucoseEnabled, state\.profile\.familyId, state\.profile\.heightCm\]\);\n\n/g;
code = code.replace(block1Regex, '');

const block2Regex = /\s*\/\/ Family listeners\s*useEffect\(\(\) => \{[\s\S]*?\}, \[state\.profile\.familyId\]\);\n/g;
code = code.replace(block2Regex, '');

const familyFnsRegex = /const createFamily = async[\s\S]*?return \{ \{ labReports: sortedReports, glucoseReadings: \[\], goals: \[\], goalLogs: \{\}, weightEntries: \[\] \} as any \}\n\s*\};\n/g;
// Wait, the regex `return \{ \{ labReports...` might not work. I will just use manual replacements for store functions.

fs.writeFileSync('src/store.tsx', code);
