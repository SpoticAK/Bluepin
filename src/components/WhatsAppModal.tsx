import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Copy, Check, ExternalLink, CheckCircle2, Unlink, RefreshCw, AlertCircle, Sparkles, FileText, Droplet } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useAppStore } from '../store';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WhatsAppModal({ isOpen, onClose }: WhatsAppModalProps) {
  const { profile, updateProfile } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(600);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [botPhone, setBotPhone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedPhone, setLinkedPhone] = useState<string | null>(profile.whatsappPhone || null);

  // Sync state if profile updates
  useEffect(() => {
    if (profile.whatsappPhone) {
      setLinkedPhone(profile.whatsappPhone);
    }
  }, [profile.whatsappPhone]);

  // Check linking status
  const checkStatus = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const res = await fetch('/api/whatsapp/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.linked) {
          setLinkedPhone(data.phone);
          if (data.phone !== profile.whatsappPhone) {
            updateProfile({ whatsappPhone: data.phone });
          }
        } else {
          setLinkedPhone(null);
        }
        if (data.botPhone) {
          setBotPhone(data.botPhone);
        }
      }
    } catch {
      // Background check error ignored
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

  // Poll status while waiting for link code to be used
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isOpen && code && !linkedPhone) {
      interval = setInterval(async () => {
        await checkStatus();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, code, linkedPhone]);

  // Countdown timer for link code
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (code && expiresIn > 0 && !linkedPhone) {
      timer = setInterval(() => {
        setExpiresIn(prev => {
          if (prev <= 1) {
            setCode(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [code, expiresIn, linkedPhone]);

  const generateLinkCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('You must be signed in.');

      const res = await fetch('/api/whatsapp/link-code', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate link code.');
      }

      setCode(data.code);
      setExpiresIn(data.expiresIn || 600);
      setDeepLink(data.deepLink);
      setBotPhone(data.botPhone);
    } catch (err: any) {
      setError(err.message || 'Could not create link code.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp from Bluepin?')) return;
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('You must be signed in.');

      const res = await fetch('/api/whatsapp/unlink', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setLinkedPhone(null);
        setCode(null);
        updateProfile({ whatsappPhone: undefined });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to unlink account.');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(`LINK ${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const minutes = Math.floor(expiresIn / 60);
  const seconds = expiresIn % 60;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative border border-neutral-100 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-emerald-50/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
              <MessageCircle size={18} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-neutral-900 leading-tight">WhatsApp Sync</h3>
              <p className="text-[11px] text-neutral-500">Log glucose & reports directly from WhatsApp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 transition-colors p-1.5 rounded-full hover:bg-neutral-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl flex items-center gap-2 border border-red-100">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {linkedPhone ? (
            /* Connected State */
            <div className="flex flex-col gap-4">
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Connected</span>
                    <p className="text-[14px] font-bold text-neutral-900">{linkedPhone}</p>
                  </div>
                </div>
                <button
                  onClick={handleUnlink}
                  disabled={loading}
                  className="text-neutral-500 hover:text-red-600 text-xs font-semibold py-1.5 px-3 rounded-lg border border-neutral-200 hover:border-red-200 hover:bg-red-50 transition-all flex items-center gap-1.5"
                >
                  <Unlink size={13} />
                  Disconnect
                </button>
              </div>

              {/* How it works */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">How to log with WhatsApp</h4>

                <div className="bg-neutral-50 rounded-2xl p-3 border border-neutral-100 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Droplet size={14} className="fill-red-600" />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-neutral-900">Text Your Glucose</p>
                    <p className="text-neutral-500 mt-0.5">
                      Send messages like <code className="bg-white px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-800 font-mono">115 Fasting</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-800 font-mono">140 PP</code>, or just <code className="bg-white px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-800 font-mono">98</code>.
                    </p>
                  </div>
                </div>

                <div className="bg-neutral-50 rounded-2xl p-3 border border-neutral-100 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={14} />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-neutral-900">Send Glucometer Photos</p>
                    <p className="text-neutral-500 mt-0.5">
                      Take a picture of your glucometer display. Bluepin's AI will automatically parse the reading and unit.
                    </p>
                  </div>
                </div>

                <div className="bg-neutral-50 rounded-2xl p-3 border border-neutral-100 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText size={14} />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-neutral-900">Upload Medical Reports</p>
                    <p className="text-neutral-500 mt-0.5">
                      Send a PDF lab report or photo. Biomarkers (HbA1c, CBC, Lipids) will be extracted and saved to your dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Unconnected State */
            <div className="flex flex-col gap-4">
              <div className="text-xs text-neutral-600 leading-relaxed">
                Connect your WhatsApp account to seamlessly record glucose logs and upload lab reports on the go without opening the app.
              </div>

              {!code ? (
                <button
                  onClick={generateLinkCode}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm py-3 rounded-2xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Generating Code...
                    </>
                  ) : (
                    <>
                      <MessageCircle size={17} />
                      Generate Link Code
                    </>
                  )}
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 text-center">
                    <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Your One-Time Code</span>
                    <div className="text-3xl font-black tracking-widest text-neutral-900 my-1 font-mono">
                      {code}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      Expires in <span className="font-semibold text-neutral-800">{minutes}:{seconds.toString().padStart(2, '0')}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={copyCode}
                      className="flex-1 py-2.5 px-3 rounded-xl border border-neutral-200 hover:border-neutral-300 bg-neutral-50 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      {copied ? 'Copied Command!' : 'Copy "LINK ' + code + '"'}
                    </button>

                    {deepLink && (
                      <a
                        href={deepLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20"
                      >
                        <ExternalLink size={14} />
                        Open WhatsApp
                      </a>
                    )}
                  </div>

                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 text-[11px] text-neutral-600 space-y-1">
                    <p className="font-semibold text-neutral-800">Instructions:</p>
                    <p>1. Open WhatsApp chat with our bot {botPhone ? <strong>({botPhone})</strong> : ''}.</p>
                    <p>2. Send the message: <code className="bg-white px-1 py-0.5 rounded border border-neutral-200 font-mono text-neutral-900 font-bold">LINK {code}</code></p>
                    <p>3. This window will automatically update as soon as you send it.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
