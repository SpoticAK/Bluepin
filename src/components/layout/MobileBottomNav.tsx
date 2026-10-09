import { Home, Droplet, FileText, Shield } from "lucide-react";
import { MobileNavItem } from "./NavItem";
import type { TabType } from "./AppShell";

type MobileBottomNavProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isAdmin: boolean;
};

export function MobileBottomNav({ activeTab, onTabChange, isAdmin }: MobileBottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-theme-card border-t border-theme-border z-50 flex justify-around p-2 pb-safe transition-colors duration-300">
      <MobileNavItem
        icon={<Home size={20} />}
        label="Dash"
        isActive={activeTab === "dashboard"}
        onClick={() => onTabChange("dashboard")}
        colorClass="text-blue-500"
      />
      <MobileNavItem
        id="nav-glucose-mobile"
        dataTour="nav-glucose"
        icon={<Droplet size={20} />}
        label="Glucose"
        isActive={activeTab === "glucose"}
        onClick={() => onTabChange("glucose")}
        colorClass="text-red-500"
      />
      <MobileNavItem
        id="nav-canvas-mobile"
        dataTour="nav-canvas"
        icon={<FileText size={20} />}
        label="Canvas"
        isActive={activeTab === "biomarkers"}
        onClick={() => onTabChange("biomarkers")}
        colorClass="text-emerald-500"
      />
      {isAdmin && (
        <MobileNavItem
          icon={<Shield size={20} />}
          label="Admin"
          isActive={activeTab === "admin"}
          onClick={() => onTabChange("admin")}
          colorClass="text-purple-500"
        />
      )}
    </nav>
  );
}
