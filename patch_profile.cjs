const fs = require('fs');
let code = fs.readFileSync('src/components/ProfileModal.tsx', 'utf8');

code = code.replace(/family,\s*leaveFamily,\s*/g, '');
code = code.replace(/const \[showLeaveConfirm, setShowLeaveConfirm\] = useState\(false\);\n/g, '');

const confirmLeaveRegex = /const confirmLeaveFamily = async \(\) => \{[\s\S]*?\};\n/g;
code = code.replace(confirmLeaveRegex, '');

const leaveConfirmBlockRegex = /if \(showLeaveConfirm\) \{[\s\S]*?return \([\s\S]*?\}\n/g;
code = code.replace(leaveConfirmBlockRegex, '');

code = code.replace(/<Row label="Family" value=\{family \? family\.name : 'Not joined'\} editable=\{false\} \/>\n/g, '');

const leaveFamilyButtonRegex = /\{family && \(\s*<button onClick=\{\(\) => setShowLeaveConfirm\(true\)\} className="w-full flex items-center py-2 border-b border-theme-border\/40 last:border-0 group hover:opacity-70 transition-opacity text-orange-500 dark:text-orange-400 outline-none">\s*<UserX size=\{16\} className="mr-3 ml-1" \/>\s*<span className="font-medium text-\[14px\]">Leave Family<\/span>\s*<\/button>\s*\)\}\s*/g;
code = code.replace(leaveFamilyButtonRegex, '');

fs.writeFileSync('src/components/ProfileModal.tsx', code);
