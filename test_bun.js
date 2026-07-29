import { matchBiomarker } from './src/lib/registry/biomarkerLookup.js';
console.log(matchBiomarker('Urea'));
console.log(matchBiomarker('Blood Urea Nitrogen'));
console.log(matchBiomarker('Blood Urea'));
console.log(matchBiomarker('BUN'));
