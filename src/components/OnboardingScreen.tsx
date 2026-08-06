import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { cn } from '../lib/utils';

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [data, setData] = useState({
    name: '',
    age: '',
    height: '',
    weight: '',
    diabetesStatus: 'No',
    profileColor: ['#3b82f6', '#ef4444', '#10b981', '#8b5cf6', '#f59e0b'][Math.floor(Math.random() * 5)]
  });

  const handleNext = () => {
    if (step < 2) setStep(step + 1);
    else handleSubmit();
  };
  
  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else auth.signOut();
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError('');
    
    try {
      const heightNum = Number(data.height) || 0;
      const weightNum = Number(data.weight) || 0;
      const bmi = heightNum > 0 && weightNum > 0 ? Number((weightNum / Math.pow(heightNum/100, 2)).toFixed(1)) : 0;
      
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, {
        name: data.name,
        age: Number(data.age) || 0,
        height: heightNum,
        weight: weightNum,
        bmi,
        photoUrl: '', // Removed photo upload, storing empty string
        profileColor: data.profileColor,
        diabetesStatus: data.diabetesStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (weightNum > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        await addDoc(collection(db, `users/${auth.currentUser.uid}/weightLogs`), {
          weight: weightNum,
          bmi,
          date: todayStr,
          createdAt: serverTimestamp()
        });
      }
      
      onComplete();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col relative overflow-hidden font-sans">
      
      {/* Top Nav */}
      <div className="w-full max-w-lg mx-auto p-6 pt-10 flex items-center justify-between z-10">
        <button 
          onClick={handleBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors text-neutral-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex gap-1.5">
          {[1, 2].map(i => (
            <div 
              key={i} 
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-6 bg-blue-500" : (i < step ? "w-1.5 bg-blue-500/40" : "w-1.5 bg-neutral-200")
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-8 flex flex-col justify-center pb-32 z-10">
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 delay-100 fill-mode-both">
          {error && (
            <div className="p-4 mb-6 text-sm text-red-600 bg-red-50 rounded-2xl border border-red-100">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-10">
              <div className="space-y-3">
                <h1 className="text-3xl font-display font-semibold text-neutral-900 tracking-tight">Let's get to know you</h1>
                <p className="text-neutral-500 text-[15px]">What should we call you?</p>
                <input 
                  type="text"
                  autoFocus
                  value={data.name}
                  onChange={e => setData({...data, name: e.target.value})}
                  className="w-full text-2xl font-medium text-neutral-900 placeholder:text-neutral-300 border-b-2 border-neutral-200 focus:border-blue-500 pb-3 focus:outline-none transition-colors bg-transparent mt-2"
                  placeholder="Your first name"
                  onKeyDown={e => e.key === 'Enter' && data.name && handleNext()}
                />
              </div>
              
              <div className="space-y-4 pt-4">
                <div>
                  <h2 className="text-xl font-display font-semibold text-neutral-900 mb-1">Managing diabetes?</h2>
                  <p className="text-neutral-500 text-[14px]">Select the option that best describes you.</p>
                </div>
                <div className="flex flex-col gap-3">
                  {['No', 'Pre diabetes', 'Yes'].map(status => (
                    <button
                      key={status}
                      onClick={() => setData({...data, diabetesStatus: status})}
                      className={cn(
                        "p-4 rounded-2xl flex items-center justify-between transition-all border-2 text-left",
                        data.diabetesStatus === status 
                          ? "border-blue-500 bg-blue-50/50 text-blue-700"
                          : "border-neutral-100 hover:border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                      )}
                    >
                      <span className="font-medium text-[16px]">{status}</span>
                      {data.diabetesStatus === status && <Check size={20} className="text-blue-500" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-display font-semibold text-neutral-900 mb-3 tracking-tight">Your basic stats</h1>
                <p className="text-neutral-500 text-[15px]">This helps us personalize your health insights.</p>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-[13px] font-medium text-neutral-500 mb-2">Age</label>
                  <input 
                    type="number"
                    autoFocus
                    value={data.age}
                    onChange={e => setData({...data, age: e.target.value})}
                    className="w-full text-xl font-medium text-neutral-900 placeholder:text-neutral-300 border-b-2 border-neutral-200 focus:border-blue-500 pb-2 focus:outline-none transition-colors bg-transparent"
                    placeholder="e.g. 30"
                  />
                </div>
                <div className="flex gap-6">
                  <div className="flex-1">
                    <label className="block text-[13px] font-medium text-neutral-500 mb-2">Height (cm)</label>
                    <input 
                      type="number"
                      value={data.height}
                      onChange={e => setData({...data, height: e.target.value})}
                      className="w-full text-xl font-medium text-neutral-900 placeholder:text-neutral-300 border-b-2 border-neutral-200 focus:border-blue-500 pb-2 focus:outline-none transition-colors bg-transparent"
                      placeholder="175"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[13px] font-medium text-neutral-500 mb-2">Weight (kg)</label>
                    <input 
                      type="number"
                      value={data.weight}
                      onChange={e => setData({...data, weight: e.target.value})}
                      className="w-full text-xl font-medium text-neutral-900 placeholder:text-neutral-300 border-b-2 border-neutral-200 focus:border-blue-500 pb-2 focus:outline-none transition-colors bg-transparent"
                      placeholder="70"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Floating Action */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent pb-10 z-20 pointer-events-none">
        <div className="w-full max-w-lg mx-auto flex justify-end pointer-events-auto">
          <button
            onClick={handleNext}
            disabled={
              loading ||
              (step === 1 && !data.name) ||
              (step === 2 && (!data.age || !data.height || !data.weight))
            }
            className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full transition-all shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <>
                {step === 2 ? 'Complete Profile' : 'Continue'}
                {step < 2 && <ArrowRight size={18} />}
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}
