const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

const targetStr = `      const additionalInfo = getAdditionalUserInfo(userCred);
      if (additionalInfo?.isNewUser || !isLogin) {
        await setDoc(doc(db, 'users', userCred.user.uid), {
          consent: getConsentPayload(navigator.userAgent)
        }, { merge: true });
      }`;

const replacementStr = `      const additionalInfo = getAdditionalUserInfo(userCred);
      if (additionalInfo?.isNewUser) {
        if (isLogin) {
          // If they used the "Sign In" tab but are a new user, they bypassed the consent checkboxes.
          // To be strictly DPDP compliant, we must enforce active consent BEFORE account creation.
          // Since Firebase created the account anyway, we should delete it and ask them to sign up properly.
          await userCred.user.delete();
          await auth.signOut();
          setError('Account not found. Please use the Sign Up tab to create an account and accept our Terms and Privacy Policy.');
          setLoading(false);
          return;
        } else {
          // Valid sign up
          await setDoc(doc(db, 'users', userCred.user.uid), {
            consent: getConsentPayload(navigator.userAgent)
          }, { merge: true });
        }
      }`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('src/components/AuthScreen.tsx', code);
  console.log("Updated Google Auth logic for strict compliance.");
} else {
  console.log("Target not found in AuthScreen for Google fix.");
}
