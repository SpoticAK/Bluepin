import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Smartphone, Mail } from "lucide-react";
import { useFirebaseAuth } from "../../hooks/useFirebaseAuth";
import { loginSchema, signUpSchema, type AuthFormValues } from "./types";
import EmailPasswordFields from "./EmailPasswordFields";
import PhoneAuthFields from "./PhoneAuthFields";
import GoogleAuthButton from "./GoogleAuthButton";
import { LegalDocType } from "../../lib/consentManager";
import { trackEvent } from "../../lib/utils";
import { db } from "../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";

const defaultValues: AuthFormValues = {
  email: "",
  password: "",
};

interface AuthFormProps {
  onOpenLegalDoc?: (doc: LegalDocType) => void;
}

export default function AuthForm({ onOpenLegalDoc }: AuthFormProps) {
  const [authMethod, setAuthMethod] = useState<"phone" | "email">("phone");
  const [isLogin, setIsLogin] = useState(true);
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp">("phone");
  const [rawPhone, setRawPhone] = useState("");

  const {
    loading,
    googleLoading,
    phoneLoading,
    error,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    sendPhoneOtp,
    verifyPhoneOtp,
    resetPhoneAuth,
    clearError,
  } = useFirebaseAuth();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    defaultValues,
    resolver: zodResolver(isLogin ? loginSchema : signUpSchema),
    mode: "onSubmit",
  });

  const handleMethodSwitch = (method: "phone" | "email") => {
    setAuthMethod(method);
    clearError();
    resetPhoneAuth();
    setPhoneStep("phone");
  };

  const handlePhoneSendOtp = async (fullPhoneNumber: string): Promise<boolean> => {
    clearError();
    const success = await sendPhoneOtp(fullPhoneNumber);
    if (success) {
      setPhoneStep("otp");
    }
    return success;
  };

  const handlePhoneVerifyOtp = async (otp: string) => {
    clearError();
    const res = await verifyPhoneOtp(otp);
    if (res?.result.user) {
      const user = res.result.user;
      if (user.phoneNumber) {
        try {
          await setDoc(
            doc(db, "users", user.uid),
            { phoneNumber: user.phoneNumber },
            { merge: true },
          );
        } catch (e) {
          console.warn("Could not sync phone number to user profile:", e);
        }
      }
      trackEvent("user_signed_up", {
        method: "Phone",
        type: res.isNewUser ? "signup" : "login",
      });
    }
  };

  const handlePhoneReset = () => {
    resetPhoneAuth();
    setPhoneStep("phone");
    clearError();
  };

  const onSubmitEmail = async (values: AuthFormValues) => {
    let res;
    if (isLogin) {
      res = await signInWithEmail(values.email, values.password);
    } else {
      res = await signUpWithEmail(values.email, values.password);
    }
    if (res) {
      trackEvent("user_signed_up", {
        method: "Email",
        type: isLogin ? "login" : "signup",
      });
    }
  };

  const handleGoogleAuth = async () => {
    const res = await signInWithGoogle();
    if (res) {
      trackEvent("user_signed_up", {
        method: "Google",
        type: res.isNewUser ? "signup" : "login",
      });
    }
  };

  const toggleEmailMode = () => {
    setIsLogin((prev) => !prev);
    reset(defaultValues);
    clearError();
  };

  return (
    <>
      {/* Auth Method Selector (Phone / Email) */}
      <div className="flex bg-theme-card-sec p-1 rounded-xl mb-5 border border-theme-border">
        <button
          type="button"
          onClick={() => handleMethodSwitch("phone")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            authMethod === "phone"
              ? "bg-theme-card text-theme-text shadow-sm"
              : "text-theme-text-sec hover:text-theme-text"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Phone OTP</span>
        </button>
        <button
          type="button"
          onClick={() => handleMethodSwitch("email")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            authMethod === "email"
              ? "bg-theme-card text-theme-text shadow-sm"
              : "text-theme-text-sec hover:text-theme-text"
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Email</span>
        </button>
      </div>

      {authMethod === "phone" ? (
        <div className="mb-6 text-left">
          <PhoneAuthFields
            step={phoneStep}
            phoneNumber={rawPhone}
            onPhoneNumberChange={setRawPhone}
            onSendOtp={handlePhoneSendOtp}
            onVerifyOtp={handlePhoneVerifyOtp}
            onReset={handlePhoneReset}
            loading={phoneLoading}
            error={error}
          />
        </div>
      ) : (
        <form
          className="space-y-4 mb-6 text-left"
          onSubmit={handleSubmit(onSubmitEmail)}
        >
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <Controller
                name="password"
                control={control}
                render={({ field: passwordField }) => (
                  <EmailPasswordFields
                    email={field.value}
                    password={passwordField.value}
                    emailError={errors.email?.message}
                    passwordError={errors.password?.message}
                    onEmailChange={field.onChange}
                    onPasswordChange={passwordField.onChange}
                    onEmailBlur={field.onBlur}
                    onPasswordBlur={passwordField.onBlur}
                  />
                )}
              />
            )}
          />

          {error && (
            <p className="text-xs text-theme-critical font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || isSubmitting}
            className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-[15px] py-3.5 rounded-full shadow-[0_8px_20px_-6px_rgba(26,115,232,0.4)] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(26,115,232,0.6)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : isLogin ? "Sign In" : "Sign Up"}
          </button>
        </form>
      )}

      <div className="flex items-center mb-4">
        <div className="flex-1 border-t border-theme-border"></div>
        <p className="px-4 text-xs text-theme-text-sec font-bold">or</p>
        <div className="flex-1 border-t border-theme-border"></div>
      </div>

      <GoogleAuthButton onClick={handleGoogleAuth} loading={googleLoading} />

      <p className="text-[11px] text-theme-text-sec text-center leading-relaxed px-1 my-4">
        By continuing, you agree to our{" "}
        <button
          type="button"
          onClick={() => onOpenLegalDoc?.("terms")}
          className="inline p-0 bg-transparent border-0 text-theme-accent hover:underline font-medium cursor-pointer align-baseline"
        >
          Terms of Service
        </button>
        {", "}
        <button
          type="button"
          onClick={() => onOpenLegalDoc?.("privacy")}
          className="inline p-0 bg-transparent border-0 text-theme-accent hover:underline font-medium cursor-pointer align-baseline"
        >
          Privacy Policy
        </button>
        {", and "}
        <button
          type="button"
          onClick={() => onOpenLegalDoc?.("cookies")}
          className="inline p-0 bg-transparent border-0 text-theme-accent hover:underline font-medium cursor-pointer align-baseline"
        >
          Cookie Policy
        </button>
        .
      </p>

      {authMethod === "email" && (
        <p className="text-center text-sm text-theme-text-sec">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={toggleEmailMode}
            className="font-bold text-theme-text hover:underline cursor-pointer"
          >
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </p>
      )}
    </>
  );
}
