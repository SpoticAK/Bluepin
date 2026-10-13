import React, { useState } from "react";
import { X, Trash2, LogOut } from "lucide-react";
import { useAppStore } from "../store";
import { auth } from "../lib/firebase";
import { useAuthUser } from "../hooks/useAuthUser";
import { useDeleteAccount } from "../hooks/useDeleteAccount";
import { LegalDocsModal } from "./LegalDocsModal";
import { WhatsAppModal } from "./WhatsAppModal";
import { NotificationsModal } from "./NotificationsModal";
import { LegalDocType } from "../lib/consentManager";
import { DeleteAccountModal } from "./profile/DeleteAccountModal";
import {
  BiometricsGrid,
  type ProfileEditField,
} from "./profile/BiometricsGrid";
import { ProfileHeader } from "./profile/ProfileHeader";
import { SettingsSection } from "./profile/SettingsSection";
import {
  DiabetesStatusModal,
  GenericEditModal,
} from "./profile/ProfileEditModals";

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { profile, updateProfile } = useAppStore();
  const user = useAuthUser();

  const [editField, setEditField] = useState<ProfileEditField | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const [openLegalDoc, setOpenLegalDoc] = useState<LegalDocType | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  const deletion = useDeleteAccount(onClose);

  const handleLogout = async () => {
    setLogoutError(null);
    try {
      await auth.signOut();
    } catch (e) {
      console.error("Failed to log out:", e);
      setLogoutError("Could not sign you out. Please try again.");
    }
  };

  const openEdit = (field: ProfileEditField, currentValue: unknown) => {
    setEditField(field);
    setEditValue(currentValue != null ? String(currentValue) : "");
  };

  const saveEdit = async () => {
    if (!editField) return;
    let valueToSave: unknown = editValue;
    if (["age", "heightCm", "weight"].includes(editField as string)) {
      const parsed = parseFloat(editValue);
      valueToSave = isNaN(parsed) ? 0 : parsed;
    }
    await updateProfile({ [editField]: valueToSave } as Partial<
      typeof profile
    >);
    setEditField(null);
  };

  const openDeleteConfirm = () => {
    deletion.reset();
    setShowDeleteConfirm(true);
  };

  if (showDeleteConfirm) {
    return (
      <DeleteAccountModal
        deleteInput={deletion.deleteInput}
        onDeleteInputChange={deletion.setDeleteInput}
        deleteError={deletion.deleteError}
        reauthMode={deletion.reauthMode}
        reauthPassword={deletion.reauthPassword}
        onReauthPasswordChange={deletion.setReauthPassword}
        isDeleting={deletion.isDeleting}
        isReauthing={deletion.isReauthing}
        onConfirm={deletion.confirmDelete}
        onConfirmPassword={deletion.confirmWithPassword}
        onConfirmGoogle={deletion.confirmWithGoogle}
        onSignOut={handleLogout}
        onBack={() => setShowDeleteConfirm(false)}
      />
    );
  }

  if (editField === "diabetesStatus") {
    return (
      <DiabetesStatusModal
        value={profile.diabetesStatus}
        onBack={() => setEditField(null)}
        onSelect={async (status) => {
          await updateProfile({
            diabetesStatus: status as typeof profile.diabetesStatus,
          });
          setEditField(null);
        }}
      />
    );
  }

  if (editField) {
    const isNumber = ["age", "heightCm", "weight"].includes(editField);
    return (
      <GenericEditModal
        title={(editField as string).replace("Cm", " (cm)")}
        value={editValue}
        isNumber={isNumber}
        onChange={setEditValue}
        onSave={saveEdit}
        onBack={() => setEditField(null)}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[28px] w-full max-w-85 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative flex flex-col border border-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={onClose}
            className="p-2 bg-neutral-100/80 hover:bg-neutral-200/80 rounded-full text-neutral-500 hover:text-neutral-900 transition-colors backdrop-blur-md"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <ProfileHeader
          user={user}
          profile={profile}
          onEditName={() => openEdit("name", profile.name)}
          onEditPhoto={() => openEdit("profileColor", profile.profileColor)}
        />

        <div className="px-4 pb-4 overflow-y-auto flex flex-col gap-2 custom-scrollbar">
          <BiometricsGrid profile={profile} onEdit={openEdit} />

          <SettingsSection
            diabetesStatus={profile.diabetesStatus || "No"}
            whatsappLabel={
              profile.whatsappPhone
                ? `Connected (${profile.whatsappPhone})`
                : "Log glucose & reports via chat"
            }
            whatsappConnected={!!profile.whatsappPhone}
            onDiabetes={() =>
              openEdit("diabetesStatus", profile.diabetesStatus || "No")
            }
            onWhatsApp={() => setShowWhatsAppModal(true)}
            onNotifications={() => setShowNotificationsModal(true)}
            onLegal={() => setOpenLegalDoc("terms")}
          />

          {logoutError && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mt-1 leading-relaxed">
              {logoutError}
            </p>
          )}
          <div className="flex gap-1.5 mt-1">
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-100 text-neutral-700 rounded-xl transition-colors text-[12px] font-semibold active:scale-[0.98] shadow-sm"
            >
              <LogOut size={13} />
              Sign Out
            </button>
            <button
              disabled={deletion.isDeleting}
              onClick={openDeleteConfirm}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-xl transition-colors text-[12px] font-semibold active:scale-[0.98] disabled:opacity-50 shadow-sm"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        </div>
      </div>
      <LegalDocsModal
        isOpen={!!openLegalDoc}
        onClose={() => setOpenLegalDoc(null)}
        defaultTab={openLegalDoc || "terms"}
      />
      <WhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
      />
      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
      />
    </div>
  );
}
