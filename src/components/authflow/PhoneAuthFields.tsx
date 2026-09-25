import React, { useState, useEffect, useRef } from "react";
import { Loader2, ArrowLeft, RotateCw, ShieldCheck } from "lucide-react";

interface PhoneAuthFieldsProps {
  onSendOtp: (fullPhoneNumber: string) => Promise<boolean>;
  onVerifyOtp: (otp: string) => Promise<void>;
  onReset: () => void;
  loading: boolean;
  error?: string | null;
  step: "phone" | "otp";
  phoneNumber: string;
  onPhoneNumberChange: (val: string) => void;
}

export default function PhoneAuthFields({
  onSendOtp,
  onVerifyOtp,
  onReset,
  loading,
  error,
  step,
  phoneNumber,
  onPhoneNumberChange,
}: PhoneAuthFieldsProps) {
  const [countryCode, setCountryCode] = useState("+91");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [resendTimer, setResendTimer] = useState<number>(30);
  const [canResend, setCanResend] = useState<boolean>(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
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
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    }
  }, [step]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = phoneNumber.replace(/\D/g, "");
    if (cleanNumber.length < 7 || cleanNumber.length > 15) {
      return;
    }
    const fullNumber = `${countryCode}${cleanNumber}`;
    await onSendOtp(fullNumber);
  };

  const handleOtpChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    // Auto-advance to next input
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto submit if all 6 filled
    if (digit && index === 5 && newDigits.every((d) => d.length === 1)) {
      onVerifyOtp(newDigits.join(""));
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
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || "";
    }
    setOtpDigits(newDigits);

    const nextIndex = Math.min(pasted.length, 5);
    otpInputRefs.current[nextIndex]?.focus();

    if (pasted.length === 6) {
      onVerifyOtp(pasted);
    }
  };

  const handleResend = async () => {
    if (!canResend || loading) return;
    const cleanNumber = phoneNumber.replace(/\D/g, "");
    const fullNumber = `${countryCode}${cleanNumber}`;
    const sent = await onSendOtp(fullNumber);
    if (sent) {
      setResendTimer(30);
      setCanResend(false);
      setOtpDigits(["", "", "", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    }
  };

  return (
    <div>
      {/* Invisible reCAPTCHA container required by Firebase */}
      <div id="recaptcha-container" />

      {step === "phone" ? (
        <form onSubmit={handlePhoneSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-theme-text mb-1.5">
              Mobile Number
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-3 bg-theme-card-sec border border-theme-border rounded-xl text-theme-text text-sm font-semibold select-none">
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
                  const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10);
                  onPhoneNumberChange(cleaned);
                }}
                className="flex-1 px-4 py-3 bg-theme-card-sec border border-theme-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A73E8] text-theme-text placeholder:text-theme-text-sec/50 text-[15px]"
              />
            </div>
            <p className="text-[11px] text-theme-text-sec mt-1.5">
              We'll send a 6-digit one-time password via SMS.
            </p>
          </div>

          {error && (
            <p className="text-xs text-theme-critical font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || phoneNumber.replace(/\D/g, "").length < 10}
            className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-[15px] py-3.5 rounded-full shadow-[0_8px_20px_-6px_rgba(26,115,232,0.4)] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(26,115,232,0.6)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending OTP...</span>
              </>
            ) : (
              <span>Get OTP</span>
            )}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-theme-card-sec/70 border border-theme-border p-3 rounded-xl">
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-theme-text-sec">
                Code sent to{" "}
                <span className="font-semibold text-theme-text">
                  {countryCode} {phoneNumber}
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-[#1A73E8] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" /> Change
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-theme-text mb-2 text-center">
              Enter 6-Digit OTP
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
                  className="w-11 sm:w-12 h-13 text-center text-xl font-bold bg-theme-card-sec border border-theme-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A73E8] text-theme-text transition-all"
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-theme-critical font-medium text-center">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => onVerifyOtp(otpDigits.join(""))}
            disabled={loading || otpDigits.some((d) => !d)}
            className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-[15px] py-3.5 rounded-full shadow-[0_8px_20px_-6px_rgba(26,115,232,0.4)] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(26,115,232,0.6)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <span>Verify & Continue</span>
            )}
          </button>

          <div className="text-center pt-1">
            {canResend ? (
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="text-xs text-[#1A73E8] hover:underline font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Resend OTP</span>
              </button>
            ) : (
              <p className="text-xs text-theme-text-sec">
                Resend OTP in{" "}
                <span className="font-semibold text-theme-text">
                  {resendTimer}s
                </span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
