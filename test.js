const { calculateStatus } = require('./dist/lib/biomarkerUtils.js');
console.log(calculateStatus('homocysteine', '23.86', null, null, 'Normal', '6-14.8'));
