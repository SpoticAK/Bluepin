import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const reports = await db.collection('lab_reports').get();
  reports.forEach(doc => {
    const data = doc.data();
    console.log("Report:", doc.id);
    data.biomarkers?.forEach(b => {
      if (b.name && b.name.toLowerCase().includes('hba1c')) {
        console.log(b);
      }
      if (b.name && b.name.toLowerCase().includes('eag')) {
        console.log(b);
      }
    });
  });
}

run().catch(console.error);
