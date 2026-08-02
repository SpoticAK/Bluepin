const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

const regexFamilyTypes = /export interface FamilyMemberMeta \{[\s\S]*?export interface FamilySummary \{[\s\S]*?\}\n/g;
code = code.replace(regexFamilyTypes, '');
code = code.replace(/\s*family: Family \| null;\n/g, '\n');
code = code.replace(/\s*familySummaries: Record<string, FamilySummary>;\n/g, '\n');

fs.writeFileSync('src/types.ts', code);
