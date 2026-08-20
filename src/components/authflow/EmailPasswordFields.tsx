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
        <label className="block text-xs font-bold text-theme-text mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={onEmailBlur}
          className="w-full px-4 py-3 bg-theme-card-sec border border-theme-border rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-border text-theme-text placeholder:text-theme-text-sec/50"
        />
        {emailError && (
          <p className="text-xs text-theme-critical mt-1">{emailError}</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-theme-text mb-1">
          Password
        </label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onBlur={onPasswordBlur}
          className="w-full px-4 py-3 bg-theme-card-sec border border-theme-border rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-border text-theme-text placeholder:text-theme-text-sec/50"
        />
        {passwordError && (
          <p className="text-xs text-theme-critical mt-1">{passwordError}</p>
        )}
      </div>
    </>
  );
}
