import React from "react";
import { AppProvider } from "./store";
import { ThemeProvider } from "./theme";
import AuthScreen from "./components/authflow/AuthScreen";
import { AppShell } from "./components/layout/AppShell";
import { useSession } from "./app/useSession";
import { LoadingSplash, AuthErrorCard } from "./app/SessionScreens";

const OnboardingScreen = React.lazy(
  () => import("./components/OnboardingScreen"),
);

function AppContent() {
  const {
    sessionUser,
    setSessionUser,
    needsOnboarding,
    setNeedsOnboarding,
    authError,
    authTimedOut,
    setAuthTimedOut,
    isExchangingMagicLink,
  } = useSession();

  if (sessionUser === undefined) {
    if (authTimedOut || authError) {
      return (
        <AuthErrorCard
          authError={authError}
          onContinueToSignIn={() => {
            setAuthTimedOut(false);
            setSessionUser(null);
          }}
        />
      );
    }

    return (
      <LoadingSplash
        message={
          isExchangingMagicLink
            ? "Logging you in via WhatsApp…"
            : "Loading Bluepin..."
        }
      />
    );
  }

  // Belt-and-braces: if the auth state already resolved to null (e.g. cached
  // session expired) while the exchange is still running, keep the splash
  // instead of flashing the login screen.
  if (sessionUser === null && isExchangingMagicLink) {
    return <LoadingSplash message="Logging you in via WhatsApp…" />;
  }

  if (sessionUser === null) {
    // WelcomeScreen is now handled by the separate marketing site (bluepin.in)
    return <AuthScreen />;
  }

  if (needsOnboarding) {
    return (
      <React.Suspense fallback={<LoadingSplash message="Loading Bluepin..." />}>
        <OnboardingScreen onComplete={() => setNeedsOnboarding(false)} />
      </React.Suspense>
    );
  }

  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
