const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = code.replace(
  `type="submit" disabled={loading}`,
  `type="submit" disabled={loading || (!isLogin && !canSignUp)}`
);

code = code.replace(
  `onClick={handleGoogleAuth} disabled={loading}`,
  `onClick={handleGoogleAuth} disabled={loading || (!isLogin && !canSignUp)}`
);

fs.writeFileSync('src/components/AuthScreen.tsx', code);
console.log("Fixed auth submit 2");
