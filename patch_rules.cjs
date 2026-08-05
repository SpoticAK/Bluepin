const fs = require('fs');

let rules = fs.readFileSync('firestore.rules', 'utf8');

// Insert after match /{document=**}
const insertPoint = 'match /{document=**} {\n      allow read, write: if false;\n    }';
const adminRule = `match /{document=**} {
      allow read, write: if false;
    }
    
    match /feedbacks/{feedbackId} {
      allow read: if request.auth != null && request.auth.token.email == "sparsh190204@gmail.com";
      allow write: if false;
    }`;

if (rules.includes(insertPoint)) {
  rules = rules.replace(insertPoint, adminRule);
  fs.writeFileSync('firestore.rules', rules);
  console.log("Updated firestore.rules");
} else {
  console.log("Could not find insert point in rules.");
}
