const fs = require('fs');
let code = fs.readFileSync('src/store.tsx', 'utf8');

// Helper to determine status
const statusHelper = `
  const getDiabetesStatusFromHbA1c = (val: number): 'Yes' | 'Pre diabetes' | 'No' => {
    if (val >= 6.5) return 'Yes';
    if (val >= 5.7) return 'Pre diabetes';
    return 'No';
  };
`;

// Insert helper inside createStore
code = code.replace(/const updateLimits = async/, statusHelper + '\n  const updateLimits = async');

// Patch addGlucoseReading
code = code.replace(/await batch\.commit\(\);\s*\}\s*catch/g, `
      // Auto-update diabetes status if HbA1c
      if (reading.timing === 'HbA1c' as any) {
        const newStatus = getDiabetesStatusFromHbA1c(reading.value);
        if (stateRef.current.profile.diabetesStatus !== newStatus) {
           const profRef = doc(db, \`users/\${uid}\`);
           batch.update(profRef, { diabetesStatus: newStatus });
        }
      }
      await batch.commit();
    } catch`);

// Patch addLabReport
code = code.replace(/await batch\.commit\(\);\s*\}\s*catch\s*\(e:\s*any\)\s*\{\s*alert\(e\.message\s*\|\|\s*"Failed to add report"\);/g, `
      // Auto-update diabetes status if HbA1c exists in lab report
      const hba1cBiomarker = report.biomarkers.find(b => b.name.toLowerCase().includes('hba1c') || b.name.toLowerCase().includes('a1c'));
      if (hba1cBiomarker && !isNaN(parseFloat(hba1cBiomarker.value))) {
         const val = parseFloat(hba1cBiomarker.value);
         const newStatus = getDiabetesStatusFromHbA1c(val);
         if (stateRef.current.profile.diabetesStatus !== newStatus) {
            const profRef = doc(db, \`users/\${uid}\`);
            batch.update(profRef, { diabetesStatus: newStatus });
         }
      }
      await batch.commit();
    } catch (e: any) {
      alert(e.message || "Failed to add report");`);

fs.writeFileSync('src/store.tsx', code);
