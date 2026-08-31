import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { auth, db } from "../lib/firebase";
import {
  doc,
  setDoc,
  serverTimestamp,
  addDoc,
  collection,
} from "firebase/firestore";
import { cn, trackEvent } from "../lib/utils";
import ConsentSection from "./authflow/ConsentSection";
import { ConsentState } from "./authflow/types";
import { LegalDocsModal } from "./LegalDocsModal";
import { getConsentPayload, LegalDocType } from "../lib/consentManager";

export default function OnboardingScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openLegalDoc, setOpenLegalDoc] = useState<LegalDocType | null>(null);

  const [consent, setConsent] = useState<ConsentState>({
    termsRead: false,
    privacyRead: false,
    legalConsent: false,
  });

  const [data, setData] = useState({
    name: "",
    age: "",
    height: "",
    weight: "",
    diabetesStatus: "No",
    profileColor: ["#3b82f6", "#ef4444", "#10b981", "#8b5cf6", "#f59e0b"][
      Math.floor(Math.random() * 5)
    ],
  });

  const isConsentComplete =
    consent.termsRead && consent.privacyRead && consent.legalConsent;

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else handleSubmit();
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else auth.signOut();
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError("");

    try {
      const heightNum = Number(data.height) || 0;
      const weightNum = Number(data.weight) || 0;
      const bmi =
        heightNum > 0 && weightNum > 0
          ? Number((weightNum / Math.pow(heightNum / 100, 2)).toFixed(1))
          : 0;

      const userRef = doc(db, "users", auth.currentUser.uid);
      await setDoc(
        userRef,
        {
          name: data.name.trim(),
          age: Number(data.age) || 0,
          height: heightNum,
          weight: weightNum,
          bmi,
          photoUrl: "",
          profileColor: data.profileColor,
          diabetesStatus: data.diabetesStatus,
          consent: getConsentPayload(navigator.userAgent),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      if (weightNum > 0) {
        const todayStr = new Date().toISOString().split("T")[0];
        await addDoc(
          collection(db, `users/${auth.currentUser.uid}/weightLogs`),
          {
            weight: weightNum,
            bmi,
            date: todayStr,
            createdAt: serverTimestamp(),
          },
        );
      }

      trackEvent('onboarding_completed');
      onComplete();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-theme-bg text-theme-text flex flex-col relative overflow-hidden font-sans">
      {/* Top Nav */}
      <div className="w-full max-w-lg mx-auto p-6 pt-10 flex items-center justify-between z-10">
        <button
          onClick={handleBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-theme-card-sec transition-colors text-theme-text-sec hover:text-theme-text"
          title={step === 1 ? "Sign out" : "Previous step"}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex gap-1.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step
                  ? "w-6 bg-blue-600 dark:bg-blue-500"
                  : i < step
                    ? "w-1.5 bg-blue-600/40 dark:bg-blue-400/40"
                    : "w-1.5 bg-theme-border",
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-8 flex flex-col justify-center pb-32 z-10">
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 delay-100 fill-mode-both">
          {error && (
            <div className="p-4 mb-6 text-sm text-theme-critical bg-theme-critical/10 rounded-2xl border border-theme-critical/20">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-3xl font-display font-semibold text-theme-text tracking-tight">
                  Terms & Consent
                </h1>
                <p className="text-theme-text-sec text-[15px]">
                  Please review and accept our data terms in compliance with
                  India's DPDP Act to proceed.
                </p>
              </div>

              <div className="pt-2">
                <ConsentSection
                  consent={consent}
                  onChange={(key, value) =>
                    setConsent((prev) => ({ ...prev, [key]: value }))
                  }
                  onSelectAll={(checked) =>
                    setConsent({
                      termsRead: checked,
                      privacyRead: checked,
                      legalConsent: checked,
                    })
                  }
                  onOpenLegalDoc={(docType) => setOpenLegalDoc(docType)}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-10">
              <div className="space-y-3">
                <h1 className="text-3xl font-display font-semibold text-theme-text tracking-tight">
                  Let's get to know you
                </h1>
                <p className="text-theme-text-sec text-[15px]">
                  What should we call you?
                </p>
                <input
                  type="text"
                  autoFocus
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  className="w-full text-2xl font-medium text-theme-text placeholder:text-theme-text-sec/40 border-b-2 border-theme-border focus:border-blue-500 pb-3 focus:outline-none transition-colors bg-transparent mt-2"
                  placeholder="Your first name"
                  onKeyDown={(e) =>
                    e.key === "Enter" && data.name.trim() && handleNext()
                  }
                />
              </div>

              <div className="space-y-4 pt-4">
                <div>
                  <h2 className="text-xl font-display font-semibold text-theme-text mb-1">
                    Managing diabetes?
                  </h2>
                  <p className="text-theme-text-sec text-[14px]">
                    Select the option that best describes you.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  {["No", "Pre diabetes", "Yes"].map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        setData({ ...data, diabetesStatus: status })
                      }
                      className={cn(
                        "p-4 rounded-2xl flex items-center justify-between transition-all border-2 text-left",
                        data.diabetesStatus === status
                          ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "border-theme-border hover:border-theme-text-sec/40 bg-theme-card text-theme-text hover:bg-theme-card-sec",
                      )}
                    >
                      <span className="font-medium text-[16px]">{status}</span>
                      {data.diabetesStatus === status && (
                        <Check size={20} className="text-blue-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-display font-semibold text-theme-text mb-3 tracking-tight">
                  Your basic stats
                </h1>
                <p className="text-theme-text-sec text-[15px]">
                  This helps us personalize your health insights.
                </p>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-[13px] font-medium text-theme-text-sec mb-2">
                    Age
                  </label>
                  <input
                    type="number"
                    autoFocus
                    value={data.age}
                    onChange={(e) => setData({ ...data, age: e.target.value })}
                    className="w-full text-xl font-medium text-theme-text placeholder:text-theme-text-sec/40 border-b-2 border-theme-border focus:border-blue-500 pb-2 focus:outline-none transition-colors bg-transparent"
                    placeholder="e.g. 30"
                  />
                </div>
                <div className="flex gap-6">
                  <div className="flex-1">
                    <label className="block text-[13px] font-medium text-theme-text-sec mb-2">
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      value={data.height}
                      onChange={(e) =>
                        setData({ ...data, height: e.target.value })
                      }
                      className="w-full text-xl font-medium text-theme-text placeholder:text-theme-text-sec/40 border-b-2 border-theme-border focus:border-blue-500 pb-2 focus:outline-none transition-colors bg-transparent"
                      placeholder="175"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[13px] font-medium text-theme-text-sec mb-2">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      value={data.weight}
                      onChange={(e) =>
                        setData({ ...data, weight: e.target.value })
                      }
                      className="w-full text-xl font-medium text-theme-text placeholder:text-theme-text-sec/40 border-b-2 border-theme-border focus:border-blue-500 pb-2 focus:outline-none transition-colors bg-transparent"
                      placeholder="70"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Floating Action */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-linear-to-t from-theme-bg via-theme-bg/90 to-transparent pb-10 z-20 pointer-events-none">
        <div className="w-full max-w-lg mx-auto flex justify-end pointer-events-auto">
          <button
            onClick={handleNext}
            disabled={
              loading ||
              (step === 1 && !isConsentComplete) ||
              (step === 2 && !data.name.trim()) ||
              (step === 3 && (!data.age || !data.height || !data.weight))
            }
            className="w-full sm:w-auto px-8 py-4 bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium rounded-full transition-all shadow-[0_8px_20px_-6px_rgba(26,115,232,0.4)] disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <>
                {step === 3 ? "Complete Profile" : "Continue"}
                {step < 3 && <ArrowRight size={18} />}
              </>
            )}
          </button>
        </div>
      </div>

      <LegalDocsModal
        isOpen={!!openLegalDoc}
        onClose={() => setOpenLegalDoc(null)}
        defaultTab={openLegalDoc || "terms"}
      />
    </div>
  );
}
