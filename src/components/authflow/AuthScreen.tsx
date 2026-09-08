import React, { useState } from "react";
import { LegalDocType } from "@/src/lib/consentManager";
import AuthForm from "./AuthForm";

const LegalDocsModal = React.lazy(() =>
  import("../LegalDocsModal").then((m) => ({ default: m.LegalDocsModal }))
);

export default function AuthScreen() {
  const [openLegalDoc, setOpenLegalDoc] = useState<LegalDocType | null>(null);
  return (
    <main className="min-h-screen bg-theme-card flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-2">
          <div
            className="flex items-center gap-2"
            style={{ animation: "float 5s ease-in-out infinite" }}
          >
            <img
              src="/bluepin-48.webp"
              srcSet="/bluepin-48.webp 1x, /bluepin-96.webp 2x, /bluepin-144.webp 3x"
              alt="Bluepin Logo"
              width={48}
              height={48}
              className="w-12 h-12 object-contain"
              fetchPriority="high"
            />
            <h1 className="text-5xl font-display tracking-tight text-theme-text">
              <span className="font-bold">Blue</span>
              <span className="font-medium opacity-80">pin.</span>
            </h1>
          </div>
        </div>
        <div className="text-center mb-8">
          <p
            className="text-[20px] md:text-[21px] text-theme-text leading-tight"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Managing{" "}
            <span className="bg-linear-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent font-medium">
              diabetes
            </span>{" "}
            just got simpler.
          </p>
        </div>
        <AuthForm onOpenLegalDoc={(doc) => setOpenLegalDoc(doc)} />
      </div>
      {openLegalDoc && (
        <React.Suspense fallback={null}>
          <LegalDocsModal
            isOpen={true}
            onClose={() => setOpenLegalDoc(null)}
            defaultTab={openLegalDoc}
          />
        </React.Suspense>
      )}
    </main>
  );
}
