import { Shield } from "lucide-react";

export function LoadingSplash({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-theme-bg text-theme-text gap-4 relative">
      <img
        src="/bluepin-48.webp"
        srcSet="/bluepin-48.webp 1x, /bluepin-96.webp 2x, /bluepin-144.webp 3x"
        alt="Bluepin Logo"
        width={48}
        height={48}
        className="w-12 h-12 object-contain animate-pulse"
        fetchPriority="high"
      />
      <p className="text-sm text-theme-text-sec font-medium">{message}</p>
    </div>
  );
}

type AuthErrorCardProps = {
  authError: string | null;
  onContinueToSignIn: () => void;
};

export function AuthErrorCard({ authError, onContinueToSignIn }: AuthErrorCardProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-theme-bg text-theme-text relative">
      <div className="max-w-sm w-full bg-theme-card border border-theme-border rounded-2xl p-6 text-center shadow-lg">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center mb-4">
          <Shield size={24} />
        </div>
        <h2 className="text-lg font-bold mb-2">Connection Timeout</h2>
        <p className="text-sm text-theme-text-sec mb-6 leading-relaxed">
          {authError ||
            "Unable to reach authentication services. Please check your internet connection and try again."}
        </p>
        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium py-3 rounded-xl transition-all shadow-sm"
          >
            Retry
          </button>
          <button
            onClick={onContinueToSignIn}
            className="w-full bg-theme-card border border-theme-border hover:bg-theme-card-sec text-theme-text-sec text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            Continue to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
