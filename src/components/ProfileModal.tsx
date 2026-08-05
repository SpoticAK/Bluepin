import React, { useState } from 'react';
import { X, User, Trash2, Camera, ChevronLeft, LogOut, ChevronRight, FileText, Droplet } from 'lucide-react';
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
  
  const openEdit = (field: keyof typeof profile, currentValue: any) => {
    setEditField(field);
    setEditValue(currentValue || '');
  };

  const saveEdit = async () => {
    let valueToSave = editValue;
    if (['age', 'heightCm', 'weight'].includes(editField as string)) {
      valueToSave = parseFloat(editValue);
      if (isNaN(valueToSave)) valueToSave = 0;
    }
    await updateProfile({ [editField!]: valueToSave });
    setEditField(null);
  };

  if (showDeleteConfirm) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" onClick={onClose}>
        <div className="bg-white rounded-3xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 relative" onClick={e => e.stopPropagation()}>
          <div className="flex items-center p-4 border-b border-neutral-100 bg-neutral-50/50">
            <button onClick={() => setShowDeleteConfirm(false)} className="mr-2 text-neutral-500 hover:text-neutral-900 transition-colors p-1">
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-[15px] font-semibold text-red-500">Delete Account</h3>
          </div>
          <div className="p-5 bg-white">
            <p className="text-neutral-700 mb-4 text-[13px] leading-relaxed">
              Are you sure you want to permanently delete your account and all data? This action cannot be undone.
            </p>
            <p className="text-neutral-500 mb-2 text-[12px]">
              Type <strong className="text-neutral-900">DELETE</strong> to confirm
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="DELETE"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-neutral-900 focus:outline-none focus:border-red-500 mb-4 text-sm"
              autoFocus
            />
            <button 
              onClick={confirmDeleteProfile}
              disabled={isDeleting || deleteInput !== 'DELETE'}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-medium text-[14px] py-3 rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-red-500"
            >
              {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (editField === 'diabetesStatus') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" onClick={onClose}>
        <div className="bg-white rounded-3xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 relative" onClick={e => e.stopPropagation()}>
          <div className="flex items-center p-4 border-b border-neutral-100 bg-neutral-50/50">
            <button onClick={() => setEditField(null)} className="mr-2 text-neutral-500 hover:text-neutral-900 transition-colors p-1">
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-[15px] font-semibold text-neutral-900">Diabetes Status</h3>
          </div>
          <div className="p-5 bg-white flex flex-col gap-2">
            {['No', 'Pre diabetes', 'Yes'].map((status) => (
              <button
                key={status}
                onClick={async () => {
                  await updateProfile({ diabetesStatus: status as any });
                  setEditField(null);
                }}
                className={cn(
                  "w-full py-3 px-4 rounded-xl text-sm font-medium transition-all text-left",
                  profile.diabetesStatus === status 
                    ? "bg-neutral-900 text-white shadow-md"
                    : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (editField) {
    const isNumber = ['age', 'heightCm', 'weight'].includes(editField);
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" onClick={onClose}>
        <div className="bg-white rounded-3xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 relative" onClick={e => e.stopPropagation()}>
          <div className="flex items-center p-4 border-b border-neutral-100 bg-neutral-50/50">
            <button onClick={() => setEditField(null)} className="mr-2 text-neutral-500 hover:text-neutral-900 transition-colors p-1">
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-[15px] font-semibold text-neutral-900 capitalize">{editField.replace('Cm', ' (cm)')}</h3>
          </div>
          <div className="p-5 bg-white">
            <input
              type={isNumber ? "number" : "text"}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-neutral-900 focus:outline-none focus:border-blue-500 mb-4 text-sm"
              autoFocus
            />
            <button 
              onClick={saveEdit}
              className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-[14px] py-3 rounded-xl transition-all shadow-[0_4px_12px_-4px_rgba(26,115,232,0.4)]"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  const StatBox = ({ label, value, onClick }: { label: string, value: string, onClick: () => void }) => (
    <div onClick={onClick} className="bg-white border border-neutral-100 p-2 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-50 transition-colors active:scale-95 shadow-sm">
      <span className="text-[11px] text-neutral-500 font-medium mb-0.5">{label}</span>
      <span className="text-[13px] font-semibold text-neutral-900">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-[28px] w-full max-w-[340px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative flex flex-col border border-neutral-100" onClick={e => e.stopPropagation()}>
        
        {/* Header with Close */}
        <div className="absolute top-3 right-3 z-10">
          <button onClick={onClose} className="p-2 bg-neutral-100/80 hover:bg-neutral-200/80 rounded-full text-neutral-500 hover:text-neutral-900 transition-colors backdrop-blur-md">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-4 pb-2 flex flex-col items-center">
          {/* Profile Picture */}
          <div className="relative mb-2 cursor-pointer group mt-2" onClick={() => openEdit('profileColor', profile.profileColor)}>
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-medium shadow-sm overflow-hidden",
              !user?.photoURL && (profile.profileColor || 'bg-[#1A73E8]')
            )}>
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                profile.name ? profile.name.charAt(0).toUpperCase() : <User size={28} />
              )}
            </div>
            <div className="absolute inset-0 bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-[2px]">
              <Camera size={16} className="text-white" />
            </div>
          </div>
          
          {/* Name & Email */}
          <div className="text-center w-full px-4">
            <h2 onClick={() => openEdit('name', profile.name)} className="text-[17px] font-bold text-neutral-900 mb-0.5 cursor-pointer hover:opacity-70 transition-opacity truncate" style={{ fontFamily: 'Garet, sans-serif' }}>
              {profile.name || 'Anonymous User'}
            </h2>
            <p className="text-neutral-500 text-[11px] truncate max-w-[200px] mx-auto">
              {user?.email || 'No email provided'}
            </p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="px-4 pb-4 overflow-y-auto flex flex-col gap-2 custom-scrollbar">
          
          {/* Biometrics Grid */}
          <div className="grid grid-cols-4 gap-1.5">
            <StatBox label="Age" value={profile.age ? profile.age.toString() : '-'} onClick={() => openEdit('age', profile.age)} />
            <StatBox label="Gender" value={profile.gender ? profile.gender.charAt(0).toUpperCase() : '-'} onClick={() => openEdit('gender', profile.gender)} />
            <StatBox label="Height" value={profile.heightCm ? `${profile.heightCm}cm` : '-'} onClick={() => openEdit('heightCm', profile.heightCm)} />
            <StatBox label="Weight" value={profile.weight ? `${profile.weight}kg` : '-'} onClick={() => openEdit('weight', profile.weight)} />
          </div>

          {/* Settings Section */}
          <div className="bg-neutral-50 rounded-2xl p-1.5 flex flex-col gap-0.5 border border-neutral-100/50 shadow-sm mt-1">
            <div onClick={() => openEdit('diabetesStatus', profile.diabetesStatus || 'No')} className="flex justify-between items-center px-3 py-2 cursor-pointer hover:bg-white rounded-xl transition-colors active:scale-[0.98]">
              <div className="flex items-center gap-2.5 text-neutral-900">
                <div className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
                  <Droplet size={14} className="fill-red-500" />
                </div>
                <span className="text-[13px] font-medium">Glucose</span>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-neutral-500">
                {profile.diabetesStatus || 'No'}
                <ChevronRight size={14} />
              </div>
            </div>
            
            <div onClick={() => setOpenLegalDoc('privacy')} className="flex justify-between items-center px-3 py-2 cursor-pointer hover:bg-white rounded-xl transition-colors active:scale-[0.98]">
              <div className="flex items-center gap-2.5 text-neutral-900">
                <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                  <FileText size={14} />
                </div>
                <span className="text-[13px] font-medium">Privacy Policy</span>
              </div>
              <ChevronRight size={14} className="text-neutral-400" />
            </div>

            <div onClick={() => setOpenLegalDoc('terms')} className="flex justify-between items-center px-3 py-2 cursor-pointer hover:bg-white rounded-xl transition-colors active:scale-[0.98]">
              <div className="flex items-center gap-2.5 text-neutral-900">
                <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FileText size={14} />
                </div>
                <span className="text-[13px] font-medium">Terms of Service</span>
              </div>
              <ChevronRight size={14} className="text-neutral-400" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1.5 mt-1">
            <button onClick={handleLogout} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-100 text-neutral-700 rounded-xl transition-colors text-[12px] font-semibold active:scale-[0.98] shadow-sm">
              <LogOut size={13} />
              Sign Out
            </button>
            <button disabled={isDeleting} onClick={() => { setDeleteInput(''); setShowDeleteConfirm(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-xl transition-colors text-[12px] font-semibold active:scale-[0.98] disabled:opacity-50 shadow-sm">
              <Trash2 size={13} />
              Delete
            </button>
          </div>
          
        </div>
      </div>
      <LegalDocsModal isOpen={!!openLegalDoc} onClose={() => setOpenLegalDoc(null)} defaultTab={openLegalDoc || 'terms'} />
    </div>
  );
}
