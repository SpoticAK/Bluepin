const fs = require('fs');
let code = fs.readFileSync('src/store.tsx', 'utf8');

const oldWeightFetch = `    const unsubWeight = onSnapshot(collection(db, \`users/\${uid}/weightLogs\`), (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setState(s => ({ ...s, weightEntries: logs }));`;

const newWeightFetch = `    const unsubWeight = onSnapshot(collection(db, \`users/\${uid}/weightLogs\`), (snapshot) => {
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt = data.createdAt;
        if (createdAt && typeof createdAt.toMillis === 'function') {
          createdAt = createdAt.toMillis();
        } else if (createdAt && createdAt.seconds) {
          createdAt = createdAt.seconds * 1000;
        }
        return { id: doc.id, ...data, createdAt } as any;
      });
      setState(s => ({ ...s, weightEntries: logs }));`;

if (code.includes('const unsubWeight = onSnapshot(collection(db, `users/${uid}/weightLogs`)')) {
  code = code.replace(oldWeightFetch, newWeightFetch);
  fs.writeFileSync('src/store.tsx', code);
  console.log('Patched store.tsx successfully');
} else {
  console.log('Failed to find oldWeightFetch');
}
