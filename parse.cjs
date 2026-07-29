const fs = require('fs');
const babel = require('@babel/parser');

try {
  const code = fs.readFileSync('src/components/BiomarkersTab.tsx', 'utf8');
  babel.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });
  console.log('Valid syntax!');
} catch (e) {
  console.log('Syntax error:', e.message);
}
