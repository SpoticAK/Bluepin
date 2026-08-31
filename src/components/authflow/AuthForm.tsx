import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFirebaseAuth } from "../../hooks/useFirebaseAuth";
import { loginSchema, signUpSchema, type AuthFormValues } from "./types";
import EmailPasswordFields from "./EmailPasswordFields";
import GoogleAuthButton from "./GoogleAuthButton";
import { LegalDocType } from "../../lib/consentManager";
import { trackEvent } from "../../lib/utils";

const defaultValues: AuthFormValues = {
  email: "",
  password: "",
};

interface AuthFormProps {
  onOpenLegalDoc?: (doc: LegalDocType) => void;
}

export default function AuthForm({ onOpenLegalDoc }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true);

  const {
    loading,
    googleLoading,
    error,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
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

  const onSubmit = async (values: AuthFormValues) => {
    let res;
    if (isLogin) {
      res = await signInWithEmail(values.email, values.password);
    } else {
      res = await signUpWithEmail(values.email, values.password);
    }
    if (res) {
      trackEvent('user_signed_up', { method: 'Email', type: isLogin ? 'login' : 'signup' });
    }
  };

  const handleGoogleAuth = async () => {
    const res = await signInWithGoogle();
    if (res) {
      trackEvent('user_signed_up', { method: 'Google', type: res.isNewUser ? 'signup' : 'login' });
    }
  };

  const toggleMode = () => {
    setIsLogin((prev) => !prev);
    reset(defaultValues);
  };

  return (
    <>
      <form
        className="space-y-4 mb-6 text-left"
        onSubmit={handleSubmit(onSubmit)}
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
          className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-[15px] py-3.5 rounded-full shadow-[0_8px_20px_-6px_rgba(26,115,232,0.4)] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(26,115,232,0.6)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? "Processing..." : isLogin ? "Sign In" : "Sign Up"}
        </button>
      </form>

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
          className="text-theme-accent hover:underline font-medium"
        >
          Terms of Service
        </button>{" "}
        and{" "}
        <button
          type="button"
          onClick={() => onOpenLegalDoc?.("privacy")}
          className="text-theme-accent hover:underline font-medium"
        >
          Privacy Policy
        </button>
        .
      </p>

      <p className="text-center text-sm text-theme-text-sec">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          onClick={toggleMode}
          className="font-bold text-theme-text hover:underline"
        >
          {isLogin ? "Sign Up" : "Sign In"}
        </button>
      </p>
    </>
  );
}
