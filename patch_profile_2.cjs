const fs = require('fs');
let code = fs.readFileSync('src/components/ProfileModal.tsx', 'utf8');

const lines = code.split('\n');
const fixedLines = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Are you sure you want to leave your family group?')) {
    // we want to skip everything from line 127 to 151
  }
}
