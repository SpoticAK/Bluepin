import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "max: 30,",
  "max: 200,"
);

fs.writeFileSync('server.ts', code);
