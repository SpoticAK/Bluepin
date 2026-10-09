import { Fingerprint, Hexagon, Sun, Moon } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../store";
import { useTheme } from "../../theme";
import { WhatsAppIcon } from "../CustomEmojis";

type HeaderActions = {
  onShowProfile: () => void;
  onShowWhatsApp: () => void;
};

export function DesktopHeaderButtons({ onShowProfile, onShowWhatsApp }: HeaderActions) {
  const { profile } = useAppStore();

  return (
    <div className="hidden md:flex absolute top-6 right-8 gap-3 z-30">
      <div className="relative group flex items-center">
        <div
          className={cn(
            "absolute top-full right-0 mt-3 whitespace-nowrap bg-theme-bg border border-theme-border text-theme-text px-3 py-1.5 rounded-xl shadow-lg text-xs font-medium transition-all duration-300 pointer-events-none z-50",
            "opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0",
          )}
        >
          {profile?.whatsappPhone
            ? `WhatsApp Connected (${profile.whatsappPhone})`
            : "Link WhatsApp"}
          <div className="absolute -top-1.25 right-3.5 w-2.5 h-2.5 bg-theme-bg border-l border-t border-theme-border transform rotate-45"></div>
        </div>
        <button
          id="whatsapp-header-btn"
          onClick={onShowWhatsApp}
          className="w-10 h-10 bg-theme-card border border-theme-border rounded-full flex items-center justify-center text-theme-text hover:bg-theme-card-sec transition-colors shadow-sm relative group"
          aria-label="WhatsApp Sync"
        >
          <div className="relative flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <WhatsAppIcon
              size={19}
              className={
                profile?.whatsappPhone
                  ? "text-emerald-500"
                  : "text-emerald-600 dark:text-emerald-400"
              }
            />
            {profile?.whatsappPhone && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-theme-card animate-pulse" />
            )}
          </div>
        </button>
      </div>
      <button
        id="profile-btn-desktop"
        data-tour="profile-btn"
        onClick={onShowProfile}
        className="w-10 h-10 bg-theme-card border border-theme-border rounded-full flex items-center justify-center text-theme-text hover:bg-theme-card-sec transition-colors shadow-sm group"
      >
        <div className="relative flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
          <Hexagon
            size={24}
            className="absolute text-theme-text opacity-50 group-hover:opacity-100 group-hover:text-blue-400 transition-colors"
          />
          <Fingerprint
            size={16}
            className="text-theme-text group-hover:text-blue-400 transition-colors"
          />
        </div>
      </button>
    </div>
  );
}

export function MobileHeader({ onShowProfile, onShowWhatsApp }: HeaderActions) {
  const { profile } = useAppStore();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="md:hidden flex items-center justify-between mb-5 pt-1 pb-2 border-b border-theme-border">
      <div className="flex items-center gap-2">
        <img
          src="/bluepin-32.webp"
          srcSet="/bluepin-32.webp 1x, /bluepin-64.webp 2x"
          alt="Bluepin Logo"
          width={32}
          height={32}
          className="w-8 h-8 object-contain scale-110"
        />
        <h1 className="text-[26px] font-display tracking-tight text-theme-text">
          <span className="font-bold">Blue</span>
          <span className="font-medium opacity-80">pin.</span>
        </h1>
      </div>
      <div className="flex items-center gap-2 relative">
        <button
          id="whatsapp-mobile-btn"
          onClick={onShowWhatsApp}
          className="text-theme-text-sec hover:text-emerald-500 p-2 group relative transition-colors"
          aria-label="WhatsApp Sync"
        >
          <div className="relative flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <WhatsAppIcon
              size={20}
              className={
                profile?.whatsappPhone
                  ? "text-emerald-500"
                  : "text-theme-text-sec group-hover:text-emerald-500"
              }
            />
            {profile?.whatsappPhone && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-theme-card animate-pulse" />
            )}
          </div>
        </button>
        <button
          onClick={toggleTheme}
          className="text-theme-text-sec p-2 group"
        >
          {theme === "dark" ? (
            <div className="relative flex items-center justify-center transition-transform duration-300">
              <Sun size={20} className="text-theme-text-sec" />
            </div>
          ) : (
            <div className="relative flex items-center justify-center transition-transform duration-300">
              <Moon size={20} className="text-theme-text-sec" />
            </div>
          )}
        </button>
        <button
          id="profile-btn-mobile"
          data-tour="profile-btn"
          onClick={onShowProfile}
          className="text-theme-text-sec p-2 group"
        >
          <div className="relative flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Hexagon
              size={24}
              className="absolute text-theme-text opacity-50 group-hover:opacity-100 group-hover:text-blue-400 transition-colors"
            />
            <Fingerprint
              size={16}
              className="text-theme-text group-hover:text-blue-400 transition-colors"
            />
          </div>
        </button>
      </div>
    </div>
  );
}
