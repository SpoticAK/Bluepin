import GoogleLogoSvg from "../GoogleLogoSvg";

interface GoogleAuthButtonProps {
  onClick: () => void;
  loading: boolean;
}

export default function GoogleAuthButton({
  onClick,
  loading,
}: GoogleAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full py-3 px-4 bg-theme-card border border-theme-border hover:bg-theme-card-sec text-theme-text font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-3 shadow-sm mb-3"
    >
      <GoogleLogoSvg />
      {loading ? "Connecting..." : "Continue with Google"}
    </button>
  );
}
