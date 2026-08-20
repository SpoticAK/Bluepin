import { useState } from "react";
import { LegalDocsModal } from "../LegalDocsModal";
import { LegalDocType } from "@/src/lib/consentManager";
import AuthForm from "./AuthForm";

export default function AuthScreen() {
  const [openLegalDoc, setOpenLegalDoc] = useState<LegalDocType | null>(null);
  return (
    <div className="min-h-screen bg-theme-card flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-2">
          <div
            className="flex items-center gap-2"
            style={{ animation: "float 5s ease-in-out infinite" }}
          >
            <img
              src="/Bluepin.png"
              alt="Bluepin Logo"
              className="w-12 h-12 object-contain"
            />
            <h1 className="text-5xl font-display tracking-tight text-theme-text">
              <span className="font-bold">Blue</span>
              <span className="font-medium opacity-80">pin.</span>
            </h1>
          </div>
        </div>
        <div className="text-center mb-8">
          <p
            className="text-[20px] md:text-[21px] text-black leading-tight"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Managing{" "}
            <span className="bg-linear-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent font-medium">
              diabetes
            </span>{" "}
            just got simpler.
          </p>
        </div>
        <AuthForm />
      </div>
      <LegalDocsModal
        isOpen={!!openLegalDoc}
        onClose={() => setOpenLegalDoc(null)}
        defaultTab={openLegalDoc || "terms"}
      />
    </div>
  );
}
