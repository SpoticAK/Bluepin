import React, { useState, useEffect, useRef } from "react";
import {
  X,
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  Unlink,
  AlertCircle,
  Sparkles,
  FileText,
  Droplet,
  ArrowLeft,
  Loader2,
  RotateCw,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { useAppStore } from "../store";
import { cn } from "../lib/utils";
import { WhatsAppIcon } from "./CustomEmojis";

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WhatsAppModal({ isOpen, onClose }: WhatsAppModalProps) {
  const { profile, updateProfile } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedPhone, setLinkedPhone] = useState<string | null>(
    profile.whatsappPhone || null,
  );

  // In-App OTP linking states
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode] = useState("+91");
  const [otpDigits, setOtpDigits] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [resendTimer, setResendTimer] = useState<number>(30);
  const [canResend, setCanResend] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Fallback bot code states
  const [showManualCode, setShowManualCode] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(600);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [botPhone, setBotPhone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Sync state if profile updates
  useEffect(() => {
    if (profile.whatsappPhone) {
      setLinkedPhone(profile.whatsappPhone);
    }
  }, [profile.whatsappPhone]);

  // Check linking status on open
  const checkStatus = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const res = await fetch("/api/whatsapp/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.linked) {
          setLinkedPhone(data.phone);
          if (data.phone !== profile.whatsappPhone) {
            updateProfile({ whatsappPhone: data.phone });
          }
        } else {
          setLinkedPhone(null);
        }
        if (data.botPhone) {
          setBotPhone(data.botPhone);
        }
      }
    } catch {
      // Ignore background check error
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      setError(null);
      setStep("phone");
      setOtpDigits(["", "", "", "", "", ""]);
    }
  }, [isOpen]);

  // Resend countdown timer for in-app OTP
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (step === "otp" && resendTimer > 0) {
      timer = setTimeout(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (step === "otp" && resendTimer === 0) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [step, resendTimer]);

  // Focus first OTP input when entering OTP step
  useEffect(() => {
    if (step === "otp") {
      setResendTimer(30);
      setCanResend(false);
      setIsResending(false);
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    }
  }, [step]);

  // Countdown timer for fallback link code
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (code && expiresIn > 0 && !linkedPhone) {
      timer = setInterval(() => {
        setExpiresIn((prev) => {
          if (prev <= 1) {
            setCode(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [code, expiresIn, linkedPhone]);

  // ─── 1. Send OTP to WhatsApp Phone ──────────────────────────────────────────
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanNumber = phoneNumber.replace(/\D/g, "");
    if (cleanNumber.length < 10) return;

    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("You must be signed in.");

      const fullNumber = `${countryCode}${cleanNumber}`;
      const res = await fetch("/api/whatsapp/link/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone: fullNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || "Failed to send WhatsApp verification code.",
        );
      }

      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Could not send verification code.");
    } finally {
      setLoading(false);
    }
  };

  // ─── 2. Verify OTP and Link Account ─────────────────────────────────────────
  const handleVerifyOtp = async (codeToVerify?: string) => {
    const otpValue = codeToVerify || otpDigits.join("");
    if (otpValue.length < 6) return;

    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("You must be signed in.");

      const cleanNumber = phoneNumber.replace(/\D/g, "");
      const fullNumber = `${countryCode}${cleanNumber}`;

      const res = await fetch("/api/whatsapp/link/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone: fullNumber, otp: otpValue }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify code.");
      }

      setLinkedPhone(data.phone || cleanNumber);
      updateProfile({ whatsappPhone: data.phone || cleanNumber });
      setStep("phone");
    } catch (err: any) {
      setError(err.message || "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  // ─── OTP Input Controls ──────────────────────────────────────────────────────
  const handleOtpChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    if (digit && index === 5 && newDigits.every((d) => d.length === 1)) {
      handleVerifyOtp(newDigits.join(""));
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setOtpDigits(newDigits);

    if (pasted.length === 6) {
      handleVerifyOtp(pasted);
    } else {
      otpInputRefs.current[pasted.length]?.focus();
    }
  };

  const handleResend = async () => {
    if (!canResend || isResending) return;
    setIsResending(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("You must be signed in.");

      const cleanNumber = phoneNumber.replace(/\D/g, "");
      const fullNumber = `${countryCode}${cleanNumber}`;

      const res = await fetch("/api/whatsapp/link/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone: fullNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend code.");
      }

      setResendTimer(30);
      setCanResend(false);
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setError(err.message || "Could not resend code.");
    } finally {
      setIsResending(false);
    }
  };

  // ─── 3. Unlink Account ────────────────────────────────────────────────────────
  const handleUnlink = async () => {
    if (!confirm("Are you sure you want to disconnect WhatsApp from Bluepin?"))
      return;
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("You must be signed in.");

      const res = await fetch("/api/whatsapp/unlink", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setLinkedPhone(null);
        setCode(null);
        setStep("phone");
        setPhoneNumber("");
        updateProfile({ whatsappPhone: undefined });
      }
    } catch (err: any) {
      setError(err.message || "Failed to unlink account.");
    } finally {
      setLoading(false);
    }
  };

  // ─── 4. Fallback Bot Code Generator ──────────────────────────────────────────
  const generateLinkCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("You must be signed in.");

      const res = await fetch("/api/whatsapp/link-code", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate link code.");
      }

      setCode(data.code);
      setExpiresIn(data.expiresIn || 600);
      setDeepLink(data.deepLink);
      setBotPhone(data.botPhone);
    } catch (err: any) {
      setError(err.message || "Could not create link code.");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(`LINK ${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative border border-neutral-100 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              {/* <MessageSquare size={16} /> */}
              <WhatsAppIcon className="size-4.5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-neutral-900 leading-tight">
                WhatsApp Sync
              </h3>
              <p className="text-[11px] text-neutral-500">
                Log glucose & reports directly from WhatsApp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 transition-colors p-1.5 rounded-full hover:bg-neutral-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl flex items-center gap-2 border border-red-100">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {linkedPhone ? (
            /* Connected State */
            <div className="flex flex-col gap-4">
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-50 text-[#1A73E8] border border-blue-200 flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1A73E8]">
                      Connected
                    </span>
                    <p className="text-[14px] font-bold text-neutral-900">
                      {linkedPhone}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleUnlink}
                  disabled={loading}
                  className="text-neutral-500 hover:text-red-600 text-xs font-semibold py-1.5 px-3 rounded-lg border border-neutral-200 hover:border-red-200 hover:bg-red-50 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Unlink size={13} />
                  Disconnect
                </button>
              </div>

              {/* How it works */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  How to log with WhatsApp
                </h4>

                <div className="bg-neutral-50 rounded-2xl p-3 border border-neutral-100 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Droplet size={14} className="fill-red-600" />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-neutral-900">
                      Text Your Glucose
                    </p>
                    <p className="text-neutral-500 mt-0.5">
                      Send messages like{" "}
                      <code className="bg-white px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-800 font-mono">
                        115 Fasting
                      </code>
                      ,{" "}
                      <code className="bg-white px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-800 font-mono">
                        140 PP
                      </code>
                      , or just{" "}
                      <code className="bg-white px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-800 font-mono">
                        98
                      </code>
                      .
                    </p>
                  </div>
                </div>

                <div className="bg-neutral-50 rounded-2xl p-3 border border-neutral-100 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={14} />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-neutral-900">
                      Send Glucometer Photos
                    </p>
                    <p className="text-neutral-500 mt-0.5">
                      Take a picture of your glucometer display. Bluepin's AI
                      will automatically parse the reading and unit.
                    </p>
                  </div>
                </div>

                <div className="bg-neutral-50 rounded-2xl p-3 border border-neutral-100 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText size={14} />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-neutral-900">
                      Upload Medical Reports
                    </p>
                    <p className="text-neutral-500 mt-0.5">
                      Send a PDF lab report or photo. Biomarkers (HbA1c, CBC,
                      Lipids) will be extracted and saved to your dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Unconnected State: In-App OTP Flow */
            <div className="flex flex-col gap-4">
              <div className="text-xs text-neutral-600 leading-relaxed">
                Connect your WhatsApp account to log blood sugar readings, send
                meter photos, and analyse lab reports instantly via WhatsApp.
              </div>

              {step === "phone" ? (
                /* Step 1: Enter Phone Number */
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                      WhatsApp Mobile Number
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-800 text-sm font-semibold select-none">
                        <span>🇮🇳</span>
                        <span>{countryCode}</span>
                      </div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="tel"
                        required
                        autoFocus
                        placeholder="Enter 10-digit number"
                        value={phoneNumber}
                        onChange={(e) => {
                          const cleaned = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 10);
                          setPhoneNumber(cleaned);
                        }}
                        className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A73E8] text-neutral-900 placeholder:text-neutral-400 text-[15px]"
                      />
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1.5 flex items-center gap-1.5 pl-2">
                      <span>
                        We'll send a 6-digit verification code to your WhatsApp.
                      </span>
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      loading || phoneNumber.replace(/\D/g, "").length < 10
                    }
                    className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-[15px] py-3.5 rounded-full shadow-[0_8px_20px_-6px_rgba(26,115,232,0.4)] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(26,115,232,0.6)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending code to WhatsApp...</span>
                      </>
                    ) : (
                      <>
                        <WhatsAppIcon className="size-5" />
                        <span>Send WhatsApp Code</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Step 2: Enter 6-digit OTP */
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-neutral-50 border border-neutral-200 p-3 rounded-xl">
                    <div className="flex items-center gap-2 text-xs">
                      <ShieldCheck className="w-4 h-4 text-[#1A73E8] shrink-0" />
                      <span className="text-neutral-600">
                        Code sent to WhatsApp{" "}
                        <span className="font-semibold text-neutral-900">
                          {countryCode} {phoneNumber}
                        </span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep("phone")}
                      className="text-xs text-[#1A73E8] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" /> Change
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-800 mb-2 text-center">
                      Enter 6-Digit WhatsApp Code
                    </label>
                    <div className="flex justify-between gap-1.5 sm:gap-2">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => {
                            otpInputRefs.current[idx] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          onPaste={handleOtpPaste}
                          className="w-11 sm:w-12 h-13 text-center text-xl font-bold bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A73E8] text-neutral-900 transition-all"
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleVerifyOtp()}
                    disabled={
                      loading || isResending || otpDigits.some((d) => !d)
                    }
                    className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-[15px] py-3.5 rounded-full shadow-[0_8px_20px_-6px_rgba(26,115,232,0.4)] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(26,115,232,0.6)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {loading && !isResending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Verify & Connect WhatsApp</span>
                    )}
                  </button>

                  <div className="text-center pt-1">
                    {canResend ? (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={loading || isResending}
                        className="text-xs text-[#1A73E8] hover:underline font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCw
                          className={cn(
                            "w-3.5 h-3.5",
                            isResending && "animate-spin",
                          )}
                        />
                        <span>
                          {isResending ? "Resending code..." : "Resend Code"}
                        </span>
                      </button>
                    ) : (
                      <p className="text-xs text-neutral-500">
                        Resend code in{" "}
                        <span className="font-semibold text-neutral-800">
                          {resendTimer}s
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Collapsible Alternative: Bot Link Code */}
              <div className="pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualCode(!showManualCode);
                    if (!code && !showManualCode) generateLinkCode();
                  }}
                  className="w-full flex items-center justify-between text-xs text-neutral-500 hover:text-neutral-800 py-1 transition-colors cursor-pointer"
                >
                  <span>Prefer to message our bot directly?</span>
                  {showManualCode ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </button>

                {showManualCode && (
                  <div className="mt-3 flex flex-col gap-3 animate-in fade-in duration-150">
                    {!code ? (
                      <button
                        onClick={generateLinkCode}
                        disabled={loading}
                        className="w-full py-2.5 px-3 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {loading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <MessageSquare size={14} />
                        )}
                        Generate Manual Code
                      </button>
                    ) : (
                      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3 text-center space-y-2">
                        <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                          Manual Code
                        </span>
                        <div className="text-2xl font-black tracking-widest text-neutral-900 font-mono">
                          {code}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={copyCode}
                            className="flex-1 py-2 px-2.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-[11px] font-semibold text-neutral-700 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            {copied ? (
                              <Check size={12} className="text-[#1A73E8]" />
                            ) : (
                              <Copy size={12} />
                            )}
                            {copied ? "Copied!" : "Copy"}
                          </button>
                          {deepLink && (
                            <a
                              href={deepLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2 px-2.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <ExternalLink size={12} />
                              Open Chat
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
