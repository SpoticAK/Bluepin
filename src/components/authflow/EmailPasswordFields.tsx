interface EmailPasswordFieldsProps {
  email: string;
  password: string;
  emailError?: string;
  passwordError?: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onEmailBlur?: () => void;
  onPasswordBlur?: () => void;
}

export default function EmailPasswordFields({
  email,
  password,
  emailError,
  passwordError,
  onEmailChange,
  onPasswordChange,
  onEmailBlur,
  onPasswordBlur,
}: EmailPasswordFieldsProps) {
  return (
    <>
      <div>
        <label htmlFor="auth-email" className="block text-xs font-bold text-theme-text mb-1">Email</label>
        <input
          id="auth-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={onEmailBlur}
          aria-describedby={emailError ? "auth-email-error" : undefined}
          aria-invalid={!!emailError}
          className="w-full px-4 py-3 bg-theme-card-sec border border-theme-border rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-border text-theme-text placeholder:text-theme-text-sec/50"
        />
        {emailError && (
          <p id="auth-email-error" className="text-xs text-theme-critical mt-1">{emailError}</p>
        )}
      </div>

      <div>
        <label htmlFor="auth-password" className="block text-xs font-bold text-theme-text mb-1">
          Password
        </label>
        <input
          id="auth-password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onBlur={onPasswordBlur}
          aria-describedby={passwordError ? "auth-password-error" : undefined}
          aria-invalid={!!passwordError}
          className="w-full px-4 py-3 bg-theme-card-sec border border-theme-border rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-border text-theme-text placeholder:text-theme-text-sec/50"
        />
        {passwordError && (
          <p id="auth-password-error" className="text-xs text-theme-critical mt-1">{passwordError}</p>
        )}
      </div>
    </>
  );
}
