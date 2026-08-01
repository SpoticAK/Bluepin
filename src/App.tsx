import React, { useState, useEffect } from "react";
import { User, Orbit, Fingerprint, Eclipse, Hexagon,
  Home,
  Activity,
  FileText,
  Target,
  Sun,
  Moon,
  Users,
  ChevronLeft,
  ChevronRight,
  Flame,
  Droplet,
} from "lucide-react";
import { cn } from "./lib/utils";
import Dashboard from "./components/Dashboard";
import GlucoseTab from "./components/GlucoseTab";
import BiomarkersTab from "./components/BiomarkersTab";
import FitnessTab from "./components/FitnessTab";
import FamilyTab from "./components/FamilyTab";
import { AppProvider, useAppStore } from "./store";
import AuthScreen from "./components/AuthScreen";
import { ProfileModal } from "./components/ProfileModal";
import OnboardingScreen from "./components/OnboardingScreen";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ThemeProvider, useTheme } from "./theme";
import { LegalDocsModal } from './components/LegalDocsModal';
import { LegalDocType } from './lib/consentManager';


type TabType = "dashboard" | "family" | "glucose" | "biomarkers" | "fitness";

function MainLayout() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [openLegalDoc, setOpenLegalDoc] = useState<LegalDocType | null>(null);
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className={cn(
        "min-h-screen bg-theme-bg text-theme-text font-sans flex flex-col md:flex-row pb-20 md:pb-0 transition-all duration-300",
        isSidebarCollapsed ? "md:pl-20" : "md:pl-64",
      )}
    >
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-theme-border bg-theme-bg pt-8 fixed top-0 bottom-0 left-0 transition-all duration-300 z-40",
          isSidebarCollapsed ? "w-20 px-2" : "w-64 px-4",
        )}
      >
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-9 bg-theme-card border border-theme-border text-theme-text rounded-full p-1 hover:bg-theme-card-sec z-10 transition-colors"
        >
          {isSidebarCollapsed ? (
            <ChevronRight size={14} />
          ) : (
            <ChevronLeft size={14} />
          )}
        </button>

        <div className="mb-5 px-2 flex justify-center md:justify-start items-center gap-2 overflow-hidden shrink-0">
          {isSidebarCollapsed ? (
            <img
              src="/Bluepin.png"
              alt="Bluepin Logo"
              className="w-8 h-8 object-contain scale-110"
            />
          ) : (
            <div className="flex items-center gap-3">
              <img
                src="/Bluepin.png"
                alt="Bluepin Logo"
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
            onClick={() => setActiveTab("dashboard")}
            isCollapsed={isSidebarCollapsed}
            colorClass="text-blue-500"
          />
          <NavItem
            icon={<Droplet />}
            label="Glucose"
            isActive={activeTab === "glucose"}
            onClick={() => setActiveTab("glucose")}
            isCollapsed={isSidebarCollapsed}
            colorClass="text-red-500"
          />
          <NavItem
            icon={<FileText />}
            label="Health Canvas"
            isActive={activeTab === "biomarkers"}
            onClick={() => setActiveTab("biomarkers")}
            isCollapsed={isSidebarCollapsed}
            colorClass="text-emerald-500"
          />
          <NavItem
            icon={<Flame />}
            label="Fitness"
            isActive={activeTab === "fitness"}
            onClick={() => setActiveTab("fitness")}
            isCollapsed={isSidebarCollapsed}
            colorClass="text-orange-500"
          />
          <NavItem
            icon={<Users />}
            label="Family"
            isActive={activeTab === "family"}
            onClick={() => setActiveTab("family")}
            isCollapsed={isSidebarCollapsed}
            colorClass="text-purple-500"
          />
        </nav>

        <div className="mt-auto pt-4 pb-8 space-y-2 shrink-0 bg-theme-bg">
          <button
            onClick={toggleTheme}
            title={
              isSidebarCollapsed
                ? theme === "dark"
                  ? "Light Mode"
                  : "Dark Mode"
                : undefined
            }
            className={cn(
              "w-full flex items-center space-x-3 py-3 rounded-xl transition-all duration-200 ease-in-out text-left text-theme-text-sec hover:bg-theme-card-sec font-medium",
              isSidebarCollapsed ? "justify-center px-0" : "px-4",
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
            {!isSidebarCollapsed && (
              <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8 overflow-y-auto relative">
        <div className="hidden md:flex absolute top-6 right-8 gap-3 z-30">
          <button 
            onClick={() => setShowProfile(true)}
            className="w-10 h-10 bg-theme-card border border-theme-border rounded-full flex items-center justify-center text-theme-text hover:bg-theme-card-sec transition-colors shadow-sm group"
          >
            <div className="relative flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Hexagon size={24} className="absolute text-theme-text opacity-50 group-hover:opacity-100 group-hover:text-blue-400 transition-colors" />
              <Fingerprint size={16} className="text-theme-text group-hover:text-blue-400 transition-colors" />
            </div>
          </button>
        </div>
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between mb-5 pt-1 pb-2 border-b border-theme-border">
          <div className="flex items-center gap-2">
            <img
              src="/Bluepin.png"
              alt="Bluepin Logo"
              className="w-8 h-8 object-contain scale-110"
            />
            <h1 className="text-[26px] font-display tracking-tight text-theme-text">
              <span className="font-bold">Blue</span>
              <span className="font-medium opacity-80">pin.</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="text-theme-text-sec p-2 group">
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
            <button onClick={() => setShowProfile(true)} className="text-theme-text-sec p-2 group">
              <div className="relative flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Hexagon size={24} className="absolute text-theme-text opacity-50 group-hover:opacity-100 group-hover:text-blue-400 transition-colors" />
              <Fingerprint size={16} className="text-theme-text group-hover:text-blue-400 transition-colors" />
            </div>
            </button>
          </div>
        </div>

        {activeTab === "dashboard" && (
          <Dashboard onNavigate={(tab: TabType) => setActiveTab(tab)} />
        )}
        {activeTab === "family" && (
          <FamilyTab onNavigate={(tab: TabType) => setActiveTab(tab)} />
        )}
        {activeTab === "glucose" && <GlucoseTab />}
        {activeTab === "biomarkers" && <BiomarkersTab />}
        {activeTab === "fitness" && <FitnessTab />}

        <footer className="mt-12 pt-8 pb-4 border-t border-theme-border/50 text-center text-xs text-theme-text-sec flex flex-wrap justify-center gap-4">
          <button onClick={() => setOpenLegalDoc('terms')} className="hover:text-theme-text transition-colors">Terms of Service</button>
          <button onClick={() => setOpenLegalDoc('privacy')} className="hover:text-theme-text transition-colors">Privacy Policy</button>
          
        </footer>
        {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      </main>
      <LegalDocsModal isOpen={!!openLegalDoc} onClose={() => setOpenLegalDoc(null)} defaultTab={openLegalDoc || 'terms'} />

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-theme-card border-t border-theme-border z-50 flex justify-around p-2 pb-safe transition-colors duration-300">
        <MobileNavItem
          icon={<Home size={20} />}
          label="Dash"
          isActive={activeTab === "dashboard"}
          onClick={() => setActiveTab("dashboard")}
          colorClass="text-blue-500"
        />
        <MobileNavItem
          icon={<Droplet size={20} />}
          label="Glucose"
          isActive={activeTab === "glucose"}
          onClick={() => setActiveTab("glucose")}
          colorClass="text-red-500"
        />
        <MobileNavItem
          icon={<FileText size={20} />}
          label="Canvas"
          isActive={activeTab === "biomarkers"}
          onClick={() => setActiveTab("biomarkers")}
          colorClass="text-emerald-500"
        />
        <MobileNavItem
          icon={<Flame size={20} />}
          label="Fitness"
          isActive={activeTab === "fitness"}
          onClick={() => setActiveTab("fitness")}
          colorClass="text-orange-500"
        />
        <MobileNavItem
          icon={<Users size={20} />}
          label="Family"
          isActive={activeTab === "family"}
          onClick={() => setActiveTab("family")}
          colorClass="text-purple-500"
        />
      </nav>
    </div>
  );
}

function NavItem({
  icon,
  label,
  isActive,
  onClick,
  isCollapsed,
  colorClass,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  isCollapsed?: boolean;
  colorClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={cn(
        "w-full flex items-center space-x-3 py-3 rounded-xl transition-all duration-200 ease-in-out text-left",
        isCollapsed ? "justify-center px-0" : "px-4",
        isActive
          ? "bg-theme-card-sec text-theme-text font-medium"
          : "text-theme-text-sec hover:bg-theme-card-sec hover:text-theme-text",
      )}
    >
      <span
        className={cn(
          "transition-colors duration-300",
          isActive ? colorClass || "text-theme-text" : "text-theme-text-sec",
        )}
      >
        {icon}
      </span>
      {!isCollapsed && <span>{label}</span>}
    </button>
  );
}

function MobileNavItem({
  icon,
  label,
  isActive,
  onClick,
  colorClass,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  colorClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center space-y-1 w-16 py-1 transition-colors",
        isActive ? "text-theme-text" : "text-theme-text-sec",
      )}
    >
      <span
        className={cn(
          "transition-colors duration-300",
          isActive ? colorClass || "text-theme-text" : "text-theme-text-sec",
        )}
      >
        {icon}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function AppContent() {
  const [sessionUser, setSessionUser] = useState<any>(undefined);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const docRef = doc(db, "users", u.uid);
          const docSnap = await getDoc(docRef);
          setNeedsOnboarding(!docSnap.exists() || !docSnap.data()?.name);
        } catch (e) {
          console.error(e);
          setNeedsOnboarding(true);
        }
      }
      setSessionUser(u);
    });
    return unsub;
  }, []);

  if (sessionUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        Loading...
      </div>
    );
  }

  if (sessionUser === null) {
    return <AuthScreen />;
  }

  if (needsOnboarding) {
    return <OnboardingScreen onComplete={() => setNeedsOnboarding(false)} />;
  }

  return (
    <ThemeProvider>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return <AppContent />;
}
