const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'ai-studio-411912a3-9066-443b-8806-f8c0885a496a'
});
const db = admin.firestore();
async function run() {
  const querySnapshot = await db.collection('users').get();
  for (const doc of querySnapshot.docs) {
    const uid = doc.id;
    const weightLogs = await db.collection(`users/${uid}/weightLogs`).get();
    weightLogs.forEach(w => console.log(w.data()));
  }
}
run();
