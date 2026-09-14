import React, { useRef, useEffect } from "react";
import Markdown from "react-markdown";
import {
  X,
  ChevronDown,
  FileText,
  Lock,
  Cookie,
  Sparkles,
  ShieldAlert,
  HeartHandshake,
} from "lucide-react";
import { LegalDocType } from "../lib/consentManager";
import { cn } from "../lib/utils";
import remarkGfm from "remark-gfm";
import privacyPolicyRaw from "../legal/Bluepin_Privacy_Policy.md?raw";
import termsOfServiceRaw from "../legal/Bluepin_Terms_of_Service.md?raw";
import cookiePolicyRaw from "../legal/Bluepin_Cookie_Tracking_Policy_Latest.md?raw";
import aiDisclaimerRaw from "../legal/Bluepin_AI_Output_Disclaimer.md?raw";
import medicalDisclaimerRaw from "../legal/Bluepin_Medical_Health_Disclaimer.md?raw";
import healthConsentRaw from "../legal/Bluepin_Health_Data_Consent_Notice_Latest.md?raw";

interface LegalDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: LegalDocType;
}

const LEGAL_DOCS: {
  id: LegalDocType;
  label: string;
  icon: React.ElementType;
  desc: string;
}[] = [
  {
    id: "terms",
    label: "Terms of Service",
    icon: FileText,
    desc: "Rules, accounts & service terms",
  },
  {
    id: "privacy",
    label: "Privacy Policy",
    icon: Lock,
    desc: "How we collect & protect data",
  },
  {
    id: "cookies",
    label: "Cookie & Tracking",
    icon: Cookie,
    desc: "Essential & analytics cookies",
  },
  {
    id: "ai-disclaimer",
    label: "AI Output Disclaimer",
    icon: Sparkles,
    desc: "Gemini AI intelligence limits",
  },
  {
    id: "medical",
    label: "Medical Disclaimer",
    icon: ShieldAlert,
    desc: "Clinical safety & care advisory",
  },
  {
    id: "health-consent",
    label: "Health Data Consent",
    icon: HeartHandshake,
    desc: "Sensitive health records consent",
  },
];

const DOC_CONTENT: Record<LegalDocType, string> = {
  terms: termsOfServiceRaw,
  privacy: privacyPolicyRaw,
  cookies: cookiePolicyRaw,
  "ai-disclaimer": aiDisclaimerRaw,
  medical: medicalDisclaimerRaw,
  "health-consent": healthConsentRaw,
};

const DOC_NAME_TO_TAB: Record<string, LegalDocType> = {
  "bluepin terms of service": "terms",
  "terms of service": "terms",
  "bluepin privacy policy": "privacy",
  "privacy policy": "privacy",
  "bluepin cookie tracking policy": "cookies",
  "cookie tracking policy": "cookies",
  "cookie policy": "cookies",
  "bluepin ai output disclaimer": "ai-disclaimer",
  "ai output disclaimer": "ai-disclaimer",
  "bluepin medical health disclaimer": "medical",
  "medical health disclaimer": "medical",
  "medical disclaimer": "medical",
  "bluepin health data consent notice": "health-consent",
  "health data consent notice": "health-consent",
  "health data consent": "health-consent",
};

function extractText(node: React.ReactNode): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in (node as any)) {
    return extractText((node as any).props.children);
  }
  return "";
}

function resolveDocTab(input: string): LegalDocType | null {
  if (!input || typeof input !== "string") return null;
  const clean = input
    .toLowerCase()
    .replace(/[#&/_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // If input is too long, it's a full sentence/paragraph, not just a document title
  if (clean.length > 50) return null;

  for (const [key, tab] of Object.entries(DOC_NAME_TO_TAB)) {
    if (clean === key || clean.includes(key)) {
      return tab;
    }
  }
  return null;
}

export function LegalDocsModal({
  isOpen,
  onClose,
  defaultTab = "terms",
}: LegalDocsModalProps) {
  const [activeTab, setActiveTab] = React.useState<LegalDocType>(defaultTab);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-100 bg-theme-text/20 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-theme-card w-full max-w-4xl h-[88vh] max-h-205 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-theme-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex justify-between items-center px-5 py-4 sm:px-6 border-b border-theme-border shrink-0 bg-theme-card">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-theme-accent/10 text-theme-accent flex items-center justify-center font-bold text-base">
              §
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-theme-text leading-tight">
                Legal & Policies
              </h2>
              <p className="text-[11px] text-theme-text-sec">
                Bluepin Terms, Privacy & Health Disclaimers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-2 bg-theme-bg hover:bg-theme-border/40 text-theme-text-sec hover:text-theme-text rounded-full transition-colors cursor-pointer border border-theme-border/50"
            aria-label="Close legal documents"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mobile Document Dropdown (< md) */}
        <div className="md:hidden px-4 py-2.5 bg-theme-bg border-b border-theme-border flex items-center justify-between shrink-0 gap-3">
          <span className="text-[11px] font-bold text-theme-text-sec uppercase tracking-wider shrink-0">
            Document:
          </span>
          <div className="relative flex-1 max-w-xs">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as LegalDocType)}
              className="w-full appearance-none bg-theme-card text-theme-text text-xs font-semibold py-2 pl-3 pr-8 rounded-xl border border-theme-border shadow-2xs focus:outline-none focus:ring-1 focus:ring-theme-accent cursor-pointer truncate"
            >
              {LEGAL_DOCS.map((doc) => (
                <option
                  key={doc.id}
                  value={doc.id}
                  className="bg-theme-card text-theme-text"
                >
                  {doc.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-theme-text-sec"
            />
          </div>
        </div>

        {/* Split View Body */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Desktop Sidebar (>= md) */}
          <aside className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 bg-theme-bg/40 border-r border-theme-border p-3 gap-1 overflow-y-auto">
            <div className="px-3 py-1.5 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-theme-text-sec">
                Documents & Disclaimers
              </span>
            </div>
            {LEGAL_DOCS.map((doc) => {
              const Icon = doc.icon;
              const isActive = activeTab === doc.id;
              return (
                <button
                  type="button"
                  key={doc.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveTab(doc.id);
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group",
                    isActive
                      ? "bg-theme-card text-theme-text font-semibold shadow-xs border border-theme-border/60"
                      : "text-theme-text-sec hover:text-theme-text hover:bg-theme-card/50 border border-transparent",
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                      isActive
                        ? "bg-theme-accent/10 text-theme-accent"
                        : "bg-theme-card text-theme-text-sec group-hover:text-theme-text border border-theme-border/50",
                    )}
                  >
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate leading-tight">
                      {doc.label}
                    </p>
                    <p className="text-[10px] text-theme-text-sec truncate mt-0.5 font-normal">
                      {doc.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Document Content Viewport */}
          <main
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 sm:p-8 lg:p-10 bg-theme-card min-w-0"
          >
            <div className="prose prose-sm md:prose-base max-w-none text-theme-text dark:prose-invert prose-headings:text-theme-text prose-p:text-theme-text/90 prose-strong:text-theme-text prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-hr:border-theme-border">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  strong: ({ children, ...props }) => {
                    const text = extractText(children);
                    const targetTab = resolveDocTab(text);
                    if (targetTab && targetTab !== activeTab) {
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveTab(targetTab);
                          }}
                          className="inline-flex items-center gap-1 font-bold dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-blue-400/50 hover:decoration-blue-600 cursor-pointer transition-all mx-0.5 text-inherit"
                          title={`Switch to ${LEGAL_DOCS.find((d) => d.id === targetTab)?.label}`}
                        >
                          <span>{children}</span>
                          <span className="text-[10px] font-normal text-blue-500/80 no-underline select-none">
                            ↗
                          </span>
                        </button>
                      );
                    }
                    return (
                      <strong className="text-theme-text font-bold" {...props}>
                        {children}
                      </strong>
                    );
                  },
                  a: ({ href, children, ...props }) => {
                    const text = extractText(children);
                    const targetTab =
                      resolveDocTab(href || "") || resolveDocTab(text);
                    if (targetTab && targetTab !== activeTab) {
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveTab(targetTab);
                          }}
                          className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          title={`Switch to ${LEGAL_DOCS.find((d) => d.id === targetTab)?.label}`}
                        >
                          <span>{children}</span>
                          <span className="text-[10px] opacity-70">↗</span>
                        </button>
                      );
                    }
                    return (
                      <a
                        href={href}
                        target={href?.startsWith("http") ? "_blank" : undefined}
                        rel={
                          href?.startsWith("http")
                            ? "noopener noreferrer"
                            : undefined
                        }
                        onClick={(e) => e.stopPropagation()}
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  },
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-6 rounded-xl border border-theme-border shadow-xs not-prose">
                      <table className="min-w-full divide-y divide-theme-border text-left text-xs sm:text-sm m-0 bg-theme-card">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-theme-card-sec text-theme-text font-semibold border-b border-theme-border">
                      {children}
                    </thead>
                  ),
                  tbody: ({ children }) => (
                    <tbody className="divide-y divide-theme-border/60 bg-theme-card text-theme-text">
                      {children}
                    </tbody>
                  ),
                  th: ({ children }) => (
                    <th className="px-4 py-3 font-semibold text-theme-text whitespace-nowrap text-left text-xs uppercase tracking-wider">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-4 py-3 text-theme-text/85 align-top text-xs sm:text-sm">
                      {children}
                    </td>
                  ),
                }}
              >
                {DOC_CONTENT[activeTab]}
              </Markdown>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
