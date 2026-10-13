// User-facing messages only. Never include Firebase's raw message/code so
// `Firebase: Error (auth/...)` strings are never shown to clients.
// Raw errors should still go to console.error at the call site.
export function getFriendlyAuthError(code?: string): string {
  switch (code) {
    case "auth/requires-recent-login":
      return "For your security, please confirm it's you before deleting your account.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "Incorrect email or password.";
    case "auth/user-mismatch":
    case "auth/user-not-found":
      return "This session doesn't match your account. Please sign out and sign in again, then retry.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/redirect-cancelled-by-user":
      return "Confirmation was cancelled. Please try again.";
    case "auth/popup-blocked":
      return "Popup was blocked by your browser. Please allow popups and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
