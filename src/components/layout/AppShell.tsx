import React, { useState } from "react";
import { cn } from "../../lib/utils";
import { auth } from "../../lib/firebase";
import type { LegalDocType } from "../../lib/consentManager";
import { InstallPWAPrompt } from "../InstallPWAPrompt";
import DashboardTour from "../DashboardTour";
import { DesktopSidebar } from "./DesktopSidebar";
import { DesktopHeaderButtons, MobileHeader } from "./AppHeaders";
import { MobileBottomNav } from "./MobileBottomNav";
import { AppFooter } from "./AppFooter";

import { Trophy, Inbox } from "lucide-react";

// Lazy-loaded heavy components (reduces initial JS bundle from ~2MB to <200KB)
const Dashboard = React.lazy(() => import("../Dashboard"));
const GlucoseTab = React.lazy(() => import("../GlucoseTab"));
const BiomarkersTab = React.lazy(() => import("../BiomarkersTab"));
const AdminFeedbackView = React.lazy(
  () => import("../AdminFeedbackView"),
);
const AdminReferralView = React.lazy(
  () => import("../AdminReferralView"),
);
const ProfileModal = React.lazy(() =>
  import("../ProfileModal").then((m) => ({
    default: m.ProfileModal,
  })),
);
const WhatsAppModal = React.lazy(() =>
  import("../WhatsAppModal").then((m) => ({
    default: m.WhatsAppModal,
  })),
);
const LegalDocsModal = React.lazy(() =>
  import("../LegalDocsModal").then((m) => ({
    default: m.LegalDocsModal,
  })),
);

export type TabType = "dashboard" | "glucose" | "biomarkers" | "admin";

const ADMIN_EMAILS_CLIENT = new Set([
  "sparsh@bluepin.in",
  ...(import.meta.env.VITE_ADMIN_EMAILS
    ? String(import.meta.env.VITE_ADMIN_EMAILS)
        .split(",")
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean)
    : []),
]);

const REFERRAL_VIEWER_EMAILS_CLIENT = new Set([
  "sparsh@bluepin.in",
  ...(import.meta.env.VITE_REFERRAL_VIEWER_EMAILS
    ? String(import.meta.env.VITE_REFERRAL_VIEWER_EMAILS)
        .split(",")
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean)
    : []),
]);

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [adminSubTab, setAdminSubTab] = useState<"feedback" | "referrals">("referrals");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [openLegalDoc, setOpenLegalDoc] = useState<LegalDocType | null>(null);

  const userEmail = auth.currentUser?.email?.toLowerCase() || "";
  const isAdmin = ADMIN_EMAILS_CLIENT.has(userEmail);
  const canViewReferrals = isAdmin || REFERRAL_VIEWER_EMAILS_CLIENT.has(userEmail);
  const hasAdminAccess = isAdmin || canViewReferrals;

  return (
    <div
      className={cn(
        "min-h-screen bg-theme-bg text-theme-text font-sans flex flex-col md:flex-row pb-20 md:pb-0 transition-all duration-300",
        isSidebarCollapsed ? "md:pl-20" : "md:pl-64",
      )}
    >
      <DashboardTour activeTab={activeTab} setActiveTab={setActiveTab} />
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isAdmin={hasAdminAccess}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8 overflow-y-auto relative">
        <DesktopHeaderButtons
          onShowProfile={() => setShowProfile(true)}
          onShowWhatsApp={() => setShowWhatsAppModal(true)}
        />
        <MobileHeader
          onShowProfile={() => setShowProfile(true)}
          onShowWhatsApp={() => setShowWhatsAppModal(true)}
        />

        <React.Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-32 gap-3 text-theme-text-sec">
              <img
                src="/bluepin-48.webp"
                alt="Loading"
                width={36}
                height={36}
                className="w-9 h-9 object-contain animate-pulse"
              />
              <span className="text-xs font-medium">Loading view...</span>
            </div>
          }
        >
          {activeTab === "dashboard" && (
            <Dashboard onNavigate={(tab: TabType) => setActiveTab(tab)} />
          )}
          {activeTab === "glucose" && <GlucoseTab />}
          {activeTab === "biomarkers" && <BiomarkersTab />}

          {activeTab === "admin" && hasAdminAccess && (
            <div className="space-y-4">
              {isAdmin && canViewReferrals && (
                <div className="flex w-full items-center gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setAdminSubTab("referrals")}
                    className={cn(
                      "px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap",
                      adminSubTab === "referrals"
                        ? "bg-theme-card text-blue-600 shadow-sm border border-theme-border"
                        : "text-theme-text-sec hover:text-theme-text hover:bg-theme-card/50",
                    )}
                  >
                    <Trophy className="w-4 h-4 text-amber-500" />
                    Referrals & Leaderboard
                  </button>
                  <button
                    onClick={() => setAdminSubTab("feedback")}
                    className={cn(
                      "px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap",
                      adminSubTab === "feedback"
                        ? "bg-theme-card text-blue-600 shadow-sm border border-theme-border"
                        : "text-theme-text-sec hover:text-theme-text hover:bg-theme-card/50",
                    )}
                  >
                    <Inbox className="w-4 h-4 text-blue-500" />
                    User Feedbacks
                  </button>
                </div>
              )}

              {adminSubTab === "referrals" && canViewReferrals && (
                <AdminReferralView />
              )}
              {adminSubTab === "feedback" && isAdmin && <AdminFeedbackView />}
            </div>
          )}

          {showProfile && (
            <ProfileModal onClose={() => setShowProfile(false)} />
          )}
          {showWhatsAppModal && (
            <WhatsAppModal
              isOpen={showWhatsAppModal}
              onClose={() => setShowWhatsAppModal(false)}
            />
          )}
        </React.Suspense>
        <AppFooter onOpenLegalDoc={setOpenLegalDoc} />
      </main>
      {openLegalDoc && (
        <React.Suspense fallback={null}>
          <LegalDocsModal
            isOpen={true}
            onClose={() => setOpenLegalDoc(null)}
            defaultTab={openLegalDoc}
          />
        </React.Suspense>
      )}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isAdmin={hasAdminAccess}
      />
      <InstallPWAPrompt />
    </div>
  );
}
