
import React, { useState } from 'react';
import { X, User, Trash2, UserX, Camera, ChevronRight, ChevronLeft, LogOut } from 'lucide-react';
import { useAppStore } from '../store';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { LegalDocsModal } from './LegalDocsModal';
import { LegalDocType } from '../lib/consentManager';

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { profile, updateProfile } = useAppStore();
  const user = auth.currentUser;
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [editField, setEditField] = useState<keyof typeof profile | null>(null);
  const [editValue, setEditValue] = useState<any>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
    const [openLegalDoc, setOpenLegalDoc] = useState<LegalDocType | null>(null);

  const dateJoined = user?.metadata.creationTime 
    ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) 
    : 'N/A';

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (e: any) {
      alert("Failed to log out: " + e.message);
    }
  };

  const confirmDeleteProfile = async () => {
    if (deleteInput !== "DELETE") return;
    setIsDeleting(true);
    try {
      if (user) {
        await user.delete();
      }
    } catch (e: any) {
      alert("Failed to delete account. You may need to sign in again first. " + e.message);
    } finally {
      setIsDeleting(false);
      onClose();
    }
  };

  
  const openEdit = (field: keyof typeof profile, currentValue: any, isBoolean = false) => {
    if (isBoolean) {
      if (window.confirm(`Toggle this setting?`)) {
        updateProfile({ [field]: !currentValue });
      }
      return;
    }
    setEditField(field);
    setEditValue(currentValue || '');
  };

  const saveEdit = async () => {
    if (!editField) return;
    let parsedValue = editValue;
    if (['age', 'heightCm', 'weight'].includes(editField)) {
      parsedValue = Number(editValue);
      if (isNaN(parsedValue)) parsedValue = undefined;
    }
    await updateProfile({ [editField]: parsedValue });
    setEditField(null);
  };

  const Row = ({ label, value, onClick, editable = true }: { label: string, value: string, onClick?: () => void, editable?: boolean }) => (
    <button 
      onClick={onClick} 
      disabled={!editable} 
      className={cn(
        "w-full flex items-center justify-between py-2 border-b border-theme-border/40 last:border-0 group outline-none",
        editable ? "hover:opacity-70 transition-opacity" : "cursor-default"
      )}
    >
      <span className="text-theme-text-sec text-[15px] pl-1">{label}</span>
      <div className="flex items-center gap-1 pr-1">
        <span className="text-theme-text font-medium text-[15px]">{value}</span>
        {editable && <ChevronRight size={16} className="text-theme-text-sec/40 group-hover:text-theme-text-sec transition-colors" />}
      </div>
    </button>
  );

  if (showDeleteConfirm) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" onClick={onClose}>
        <div className="bg-theme-card dark:bg-[#0f172a] rounded-[24px] w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 relative" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-theme-border">
            <button onClick={() => setShowDeleteConfirm(false)} className="flex items-center text-theme-text-sec hover:text-theme-text font-medium transition-colors">
              <ChevronLeft size={20} className="mr-1"/> Back
            </button>
            <h3 className="font-semibold text-theme-critical">Delete Account</h3>
            <div className="w-16" /> {/* Spacer */}
          </div>
          <div className="p-6">
            <p className="text-theme-text mb-4 text-[15px]">
              Are you sure you want to permanently delete your account and all data? This action cannot be undone.
            </p>
            <p className="text-theme-text-sec mb-4 text-[14px]">
              Type <strong>DELETE</strong> below to confirm.
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="DELETE"
              className="w-full bg-theme-bg border border-theme-border rounded-xl px-4 py-3 text-theme-text focus:outline-none focus:ring-2 focus:ring-red-500 mb-6 uppercase"
              autoFocus
            />
            <button 
              onClick={confirmDeleteProfile}
              disabled={isDeleting || deleteInput !== 'DELETE'}
              className="w-full bg-theme-critical hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Permanently Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (editField) {
    const isNumber = ['age', 'heightCm', 'weight'].includes(editField);
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" onClick={onClose}>
        <div className="bg-theme-card dark:bg-[#0f172a] rounded-[24px] w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 relative" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-theme-border">
            <button onClick={() => setEditField(null)} className="flex items-center text-blue-500 font-medium">
              <ChevronLeft size={20} className="mr-1"/> Back
            </button>
            <h3 className="font-semibold text-theme-text capitalize">{editField.replace('Cm', ' (cm)')}</h3>
            <div className="w-16" /> {/* Spacer */}
          </div>
          <div className="p-6">
            <input
              type={isNumber ? "number" : "text"}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full bg-theme-bg border border-theme-border rounded-xl px-4 py-3 text-theme-text focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
              autoFocus
            />
            <button 
              onClick={saveEdit}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-theme-card dark:bg-[#0f172a] rounded-[24px] w-full max-w-md shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 relative" onClick={e => e.stopPropagation()}>
        
        <div className="px-4 pt-5 pb-3 flex flex-col items-center text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-theme-bg flex items-center justify-center text-theme-text-sec hover:text-theme-text transition-colors z-10">
            <X size={18} />
          </button>

          <div className="relative mb-2 cursor-pointer group" onClick={() => openEdit('profileColor', profile.profileColor)}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-sm ${profile.profileColor || 'bg-blue-500'}`}>
              {profile.name ? profile.name.charAt(0).toUpperCase() : <User size={32} />}
            </div>
            <div className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera size={20} className="text-white" />
            </div>
          </div>
          
          <h2 onClick={() => openEdit('name', profile.name)} className="text-[18px] font-bold text-theme-text mb-0.5 tracking-tight cursor-pointer hover:opacity-70 transition-opacity">
            {profile.name || 'Anonymous User'}
          </h2>
          <p className="text-theme-text-sec text-[12px]">Joined {dateJoined}</p>
        </div>

        <div className="px-4 pb-4 space-y-4">
          <div className="px-2">
            <Row label="Age" value={profile.age ? profile.age.toString() : 'Not set'} onClick={() => openEdit('age', profile.age)} />
            <Row label="Gender" value={profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : 'Not set'} onClick={() => openEdit('gender', profile.gender)} />
            <Row label="Height" value={profile.heightCm ? `${profile.heightCm} cm` : 'Not set'} onClick={() => openEdit('heightCm', profile.heightCm)} />
            <Row label="Weight" value={profile.weight ? `${profile.weight} kg` : 'Not set'} onClick={() => openEdit('weight', profile.weight)} />
            <Row label="Diabetes Status" value={profile.glucoseEnabled ? 'Diabetic' : 'Non-diabetic'} onClick={() => openEdit('glucoseEnabled', profile.glucoseEnabled, true)} />
                      </div>

          
          <div className="pt-0">
            <h4 className="text-[11px] font-semibold text-theme-text-sec/70 uppercase tracking-wider mb-1 pl-1">Legal</h4>
            <div className="px-2">
              <button onClick={() => setOpenLegalDoc('privacy')} className="w-full flex items-center py-2 border-b border-theme-border/40 last:border-0 group hover:opacity-70 transition-opacity text-theme-text outline-none">
                <span className="font-medium text-[14px]">Privacy Policy</span>
              </button>
              <button onClick={() => setOpenLegalDoc('terms')} className="w-full flex items-center py-2 border-b border-theme-border/40 last:border-0 group hover:opacity-70 transition-opacity text-theme-text outline-none">
                <span className="font-medium text-[14px]">Terms of Service</span>
              </button>
              
            </div>
          </div>
          <div className="pt-0">
            <h4 className="text-[11px] font-semibold text-theme-text-sec/70 uppercase tracking-wider mb-1 pl-1">Account Actions</h4>
            <div className="px-2">
              <button onClick={handleLogout} className="w-full flex items-center py-2 border-b border-theme-border/40 last:border-0 group hover:opacity-70 transition-opacity text-theme-text outline-none">
                <LogOut size={16} className="mr-3 ml-1 text-theme-text-sec" />
                <span className="font-medium text-[14px]">Log Out</span>
              </button>
            </div>
          </div>

          <div className="pt-0">
            <h4 className="text-[11px] font-semibold text-theme-text-sec/70 uppercase tracking-wider mb-1 pl-1">Danger Zone</h4>
            <div className="px-2">
              <button disabled={isDeleting} onClick={() => { setDeleteInput(''); setShowDeleteConfirm(true); }} className="w-full flex items-center py-2 border-b border-theme-border/40 last:border-0 group hover:opacity-70 transition-opacity text-red-500 dark:text-red-400 disabled:opacity-50 outline-none">
                <Trash2 size={16} className="mr-3 ml-1" />
                <span className="font-medium text-[14px]">{isDeleting ? 'Deleting...' : 'Delete Account'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <LegalDocsModal isOpen={!!openLegalDoc} onClose={() => setOpenLegalDoc(null)} defaultTab={openLegalDoc || 'terms'} />
    </div>
  );
}
