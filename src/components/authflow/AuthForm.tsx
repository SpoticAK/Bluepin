import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFirebaseAuth } from "../../hooks/useFirebaseAuth";
import { loginSchema, signUpSchema, type AuthFormValues } from "./types";
import ConsentSection from "./ConsentSection";
import EmailPasswordFields from "./EmailPasswordFields";
import GoogleAuthButton from "./GoogleAuthButton";

const defaultValues: AuthFormValues = {
  email: "",
  password: "",
  consent: { termsRead: false, privacyRead: false, legalConsent: false },
};

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [pendingGoogleConsent, setPendingGoogleConsent] = useState(false);

  const {
    loading,
    googleLoading,
    error,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    abandonUnconsentedGoogleSignup,
  } = useFirebaseAuth();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    defaultValues,
    resolver: zodResolver(isLogin ? loginSchema : signUpSchema),
    mode: "onSubmit",
  });

  const consent = watch("consent");

  const onSubmit = async (values: AuthFormValues) => {
    const result = isLogin
      ? await signInWithEmail(values.email, values.password)
      : await signUpWithEmail(values.email, values.password);

    if (result) {
      // navigate / close modal / etc.
    }
  };

  const handleGoogleAuth = async () => {
    const googleAuthResult = await signInWithGoogle();
    if (!googleAuthResult) return; // error already set by the hook

    if (googleAuthResult.isNewUser) {
      // Account was just created by the popup — hold here until they consent,
      // regardless of which screen (Login or Sign Up) they started from.
      setPendingGoogleConsent(true);
      return;
    }

    // Existing user, already consented at original signup — just proceed.
    // navigate / close modal / etc.
  };

  const confirmGoogleConsent = async () => {
    const valid = ["termsRead", "privacyRead", "legalConsent"].every(
      (k) => consent[k as keyof typeof consent],
    );
    if (!valid) {
      setError("consent.legalConsent", {
        type: "manual",
        message: "Please give the required consents above.",
      });
      return;
    }
    setPendingGoogleConsent(false);
    // navigate / finalize — account is now considered active
  };

  const cancelGoogleConsent = async () => {
    await abandonUnconsentedGoogleSignup();
    setPendingGoogleConsent(false);
    reset(defaultValues);
  };

  const toggleMode = () => {
    setIsLogin((prev) => !prev);
    reset(defaultValues);
  };

  if (pendingGoogleConsent) {
    return (
      <div className="space-y-4 text-left">
        <p className="text-sm text-theme-text-sec mb-3">
          Before we finish setting up your account, please review and confirm:
        </p>
        <ConsentSection
          consent={consent}
          onChange={(key, value) =>
            setValue(`consent.${key}`, value, { shouldValidate: true })
          }
          onSelectAll={(checked) =>
            setValue(
              "consent",
              {
                termsRead: checked,
                privacyRead: checked,
                legalConsent: checked,
              },
              { shouldValidate: true },
            )
          }
          error={errors.consent?.legalConsent?.message}
        />
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={cancelGoogleConsent}
            className="flex-1 py-3 rounded-full border border-theme-border font-medium hover:bg-theme-hover
  transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmGoogleConsent}
            className="flex-1 py-3 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium
  transition"
          >
            Confirm & Continue
          </button>
        </div>
      </div>
    );
  }

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

        {!isLogin && (
          <ConsentSection
            consent={consent}
            onChange={(key, value) =>
              setValue(`consent.${key}`, value, { shouldValidate: true })
            }
            onSelectAll={(checked) =>
              setValue(
                "consent",
                {
                  termsRead: checked,
                  privacyRead: checked,
                  legalConsent: checked,
                },
                { shouldValidate: true },
              )
            }
            error={
              errors.consent?.legalConsent?.message ??
              errors.consent?.root?.message
            }
          />
        )}

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
