import { ChevronLeft } from "lucide-react";
import type { ReauthMode } from "../../hooks/useDeleteAccount";

interface Props {
  deleteInput: string;
  onDeleteInputChange: (v: string) => void;
  deleteError: string | null;
  reauthMode: ReauthMode;
  reauthPassword: string;
  onReauthPasswordChange: (v: string) => void;
  isDeleting: boolean;
  isReauthing: boolean;
  onConfirm: () => void;
  onConfirmPassword: () => void;
  onConfirmGoogle: () => void;
  onSignOut: () => void;
  onBack: () => void;
}

export function DeleteAccountModal({
  deleteInput,
  onDeleteInputChange,
  deleteError,
  reauthMode,
  reauthPassword,
  onReauthPasswordChange,
  isDeleting,
  isReauthing,
  onConfirm,
  onConfirmPassword,
  onConfirmGoogle,
  onSignOut,
  onBack,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      onClick={onBack}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center p-4 border-b border-neutral-100 bg-neutral-50/50">
          <button
            onClick={onBack}
            className="mr-2 text-neutral-500 hover:text-neutral-900 transition-colors p-1"
          >
            <ChevronLeft size={20} />
          </button>
          <h3 className="text-[15px] font-semibold text-red-500">
            Delete Account
          </h3>
        </div>
        <div className="p-5 bg-white">
          <p className="text-neutral-700 mb-4 text-[13px] leading-relaxed">
            Are you sure you want to permanently delete your account and all
            data? This action cannot be undone.
          </p>
          <p className="text-neutral-500 mb-2 text-[12px]">
            Type <strong className="text-neutral-900">DELETE</strong> to confirm
          </p>
          <input
            type="text"
            value={deleteInput}
            onChange={(e) => onDeleteInputChange(e.target.value)}
            placeholder="DELETE"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-neutral-900 focus:outline-none focus:border-red-500 mb-4 text-sm"
            autoFocus
          />
          {deleteError && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3 leading-relaxed">
              {deleteError}
            </p>
          )}
          {reauthMode === "password" && (
            <div className="mb-3">
              <p className="text-neutral-500 mb-2 text-[12px]">
                Enter your password to confirm it&apos;s you
              </p>
              <input
                type="password"
                value={reauthPassword}
                onChange={(e) => onReauthPasswordChange(e.target.value)}
                placeholder="Account password"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-neutral-900 focus:outline-none focus:border-red-500 mb-2 text-sm"
              />
              <button
                onClick={onConfirmPassword}
                disabled={isReauthing || !reauthPassword}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-medium text-[14px] py-3 rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-red-500"
              >
                {isReauthing ? "Confirming..." : "Confirm Identity & Delete"}
              </button>
            </div>
          )}
          {reauthMode === "google" && (
            <div className="mb-3">
              <button
                onClick={onConfirmGoogle}
                disabled={isReauthing}
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-[14px] py-3 rounded-xl transition-all disabled:opacity-50"
              >
                {isReauthing ? "Confirming..." : "Confirm with Google & Delete"}
              </button>
            </div>
          )}
          {reauthMode === "manual" && (
            <div className="mb-3">
              <p className="text-neutral-500 mb-2 text-[12px]">
                Please sign out, sign in again, then retry deletion.
              </p>
              <button
                onClick={onSignOut}
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-[14px] py-3 rounded-xl transition-all"
              >
                Sign Out
              </button>
            </div>
          )}
          {!reauthMode && (
            <button
              onClick={onConfirm}
              disabled={isDeleting || deleteInput !== "DELETE"}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-medium text-[14px] py-3 rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-red-500"
            >
              {isDeleting ? "Deleting..." : "Confirm Deletion"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
