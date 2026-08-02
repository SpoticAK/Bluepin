const fs = require('fs');
let code = fs.readFileSync('src/store.tsx', 'utf8');

const oldWeightFetch = `        if (createdAt && typeof createdAt.toMillis === 'function') {
          createdAt = createdAt.toMillis();
        } else if (createdAt && createdAt.seconds) {
          createdAt = createdAt.seconds * 1000;
        }`;

const newWeightFetch = `        if (createdAt && typeof createdAt.toMillis === 'function') {
          createdAt = createdAt.toMillis();
        } else if (createdAt && createdAt.seconds) {
          createdAt = createdAt.seconds * 1000;
        } else if (createdAt && typeof createdAt === 'object' && Object.keys(createdAt).length === 0) {
          createdAt = new Date(data.date).getTime();
        }`;

code = code.replace(oldWeightFetch, newWeightFetch);
fs.writeFileSync('src/store.tsx', code);
