import { useState } from "react";
import {
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { getFriendlyAuthError } from "../lib/friendlyAuthError";

export type ReauthMode = null | "password" | "google" | "manual";

async function unlinkWhatsAppBestEffort() {
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  try {
    const idToken = await currentUser.getIdToken();
    await fetch("/api/whatsapp/unlink", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    });
  } catch (unlinkErr) {
    console.warn("Could not unlink WhatsApp before account deletion:", unlinkErr);
  }
}

function decideMode(): Exclude<ReauthMode, null> {
  const providers = auth.currentUser?.providerData.map((p) => p.providerId) ?? [];
  if (providers.includes("password")) return "password";
  if (providers.includes("google.com")) return "google";
  return "manual";
}

export function useDeleteAccount(onDeleted: () => void) {
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reauthMode, setReauthMode] = useState<ReauthMode>(null);
  const [reauthPassword, setReauthPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReauthing, setIsReauthing] = useState(false);

  const reset = () => {
    setDeleteInput("");
    setDeleteError(null);
    setReauthMode(null);
    setReauthPassword("");
  };

  const confirmDelete = async () => {
    if (deleteInput !== "DELETE") return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setDeleteError("You are already signed out.");
        return;
      }
      await unlinkWhatsAppBestEffort();
      await deleteUser(currentUser);
      onDeleted();
    } catch (e: any) {
      console.error("Failed to delete account:", e);
      if (e?.code === "auth/requires-recent-login") {
        setReauthMode(decideMode());
        setDeleteError(getFriendlyAuthError(e?.code));
      } else {
        setDeleteError(getFriendlyAuthError(e?.code));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmWithPassword = async () => {
    if (!reauthPassword) {
      setDeleteError("Please enter your password to confirm deletion.");
      return;
    }
    setIsReauthing(true);
    setDeleteError(null);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser?.email) {
        setDeleteError("Could not confirm your account. Please sign in again and retry.");
        return;
      }
      const credential = EmailAuthProvider.credential(currentUser.email, reauthPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await unlinkWhatsAppBestEffort();
      await deleteUser(auth.currentUser!);
      onDeleted();
    } catch (e: any) {
      console.error("Re-authentication failed:", e);
      setDeleteError(getFriendlyAuthError(e?.code));
    } finally {
      setIsReauthing(false);
    }
  };

  const confirmWithGoogle = async () => {
    setIsReauthing(true);
    setDeleteError(null);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setDeleteError("You are already signed out.");
        return;
      }
      // Popup-based re-auth doesn't work in iOS standalone PWAs.
      const isIosStandalone =
        /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
        (window.navigator as any).standalone === true;
      if (isIosStandalone) {
        setReauthMode("manual");
        setDeleteError("Please sign out and sign in again, then retry deletion.");
        return;
      }
      await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
      await unlinkWhatsAppBestEffort();
      await deleteUser(auth.currentUser!);
      onDeleted();
    } catch (e: any) {
      console.error("Google re-authentication failed:", e);
      setDeleteError(getFriendlyAuthError(e?.code));
    } finally {
      setIsReauthing(false);
    }
  };

  return {
    deleteInput,
    setDeleteInput,
    deleteError,
    reauthMode,
    reauthPassword,
    setReauthPassword,
    isDeleting,
    isReauthing,
    reset,
    confirmDelete,
    confirmWithPassword,
    confirmWithGoogle,
  };
}
