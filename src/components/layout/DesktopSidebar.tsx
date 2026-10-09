import { Home, Droplet, FileText, Shield, Sun, Moon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTheme } from "../../theme";
import { NavItem } from "./NavItem";
import type { TabType } from "./AppShell";

type DesktopSidebarProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isAdmin: boolean;
};

export function DesktopSidebar({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  isAdmin,
}: DesktopSidebarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-theme-border bg-theme-bg pt-8 fixed top-0 bottom-0 left-0 transition-all duration-300 z-40",
        isCollapsed ? "w-20 px-2" : "w-64 px-4",
      )}
    >
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-9 bg-theme-card border border-theme-border text-theme-text rounded-full p-1 hover:bg-theme-card-sec z-10 transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight size={14} />
        ) : (
          <ChevronLeft size={14} />
        )}
      </button>

      <div className="mb-5 px-2 flex justify-center md:justify-start items-center gap-2 overflow-hidden shrink-0">
        {isCollapsed ? (
          <img
            src="/bluepin-32.webp"
            srcSet="/bluepin-32.webp 1x, /bluepin-64.webp 2x"
            alt="Bluepin Logo"
            width={32}
            height={32}
            className="w-8 h-8 object-contain scale-110"
          />
        ) : (
          <div className="flex items-center gap-3">
            <img
              src="/bluepin-48.webp"
              srcSet="/bluepin-48.webp 1x, /bluepin-96.webp 2x"
              alt="Bluepin Logo"
              width={40}
              height={40}
              className="w-10 h-10 object-contain scale-110"
            />
            <h1 className="text-[30px] font-display tracking-tight text-theme-text truncate">
              <span className="font-bold">Blue</span>
              <span className="font-medium opacity-80">pin.</span>
            </h1>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto space-y-1.5 pr-1 pb-4">
        <NavItem
          icon={<Home />}
          label="Dashboard"
          isActive={activeTab === "dashboard"}
          onClick={() => onTabChange("dashboard")}
          isCollapsed={isCollapsed}
          colorClass="text-blue-500"
        />
        <NavItem
          id="nav-glucose-desktop"
          dataTour="nav-glucose"
          icon={<Droplet />}
          label="Glucose"
          isActive={activeTab === "glucose"}
          onClick={() => onTabChange("glucose")}
          isCollapsed={isCollapsed}
          colorClass="text-red-500"
        />
        <NavItem
          id="nav-canvas-desktop"
          dataTour="nav-canvas"
          icon={<FileText />}
          label="Health Canvas"
          isActive={activeTab === "biomarkers"}
          onClick={() => onTabChange("biomarkers")}
          isCollapsed={isCollapsed}
          colorClass="text-emerald-500"
        />

        {isAdmin && (
          <NavItem
            icon={<Shield />}
            label="Admin"
            isActive={activeTab === "admin"}
            onClick={() => onTabChange("admin")}
            isCollapsed={isCollapsed}
            colorClass="text-purple-500"
          />
        )}
      </nav>

      <div className="mt-auto pt-4 pb-8 space-y-2 shrink-0 bg-theme-bg">
        <button
          onClick={toggleTheme}
          title={
            isCollapsed
              ? theme === "dark"
                ? "Light Mode"
                : "Dark Mode"
              : undefined
          }
          className={cn(
            "w-full flex items-center space-x-3 py-3 rounded-xl transition-all duration-200 ease-in-out text-left text-theme-text-sec hover:bg-theme-card-sec font-medium",
            isCollapsed ? "justify-center px-0" : "px-4",
          )}
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
          {!isCollapsed && (
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          )}
        </button>
      </div>
    </aside>
  );
}
