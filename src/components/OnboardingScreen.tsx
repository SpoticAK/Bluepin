import React, { useState, useRef } from 'react';
import { auth, db, storage } from '../lib/firebase';
import { User, Camera, ArrowLeft } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [data, setData] = useState({
    name: '',
    age: '',
    gender: 'Prefer not to say',
    height: '',
    weight: '',
    country: '',
    photoUrl: '',
    profileColor: '',
    diabetesStatus: 'No Diabetes'
  });
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateRandomColor = () => {
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  React.useEffect(() => {
    setData(prev => ({...prev, profileColor: generateRandomColor()}));
  }, []);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be less than 5MB");
        return;
      }
      setUploading(true);
      setError('');
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const storageRef = ref(storage, `users/${auth.currentUser?.uid}/profile.${ext}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        setData(prev => ({ ...prev, photoUrl: url }));
      } catch (err: any) {
        console.error("Upload error", err);
        setError("Failed to upload image. " + (err.message || ''));
      } finally {
        setUploading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 1) {
      setStep(2);
      return;
    }

    if (!auth.currentUser) return;

    setLoading(true);
    setError('');

    try {
      const heightNum = Number(data.height);
      const weightNum = Number(data.weight);
      const bmi = heightNum > 0 && weightNum > 0 ? Number((weightNum / Math.pow(heightNum/100, 2)).toFixed(1)) : 0;

      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, {
        name: data.name,
        age: Number(data.age) || 0,
        gender: data.gender,
        height: heightNum,
        weight: weightNum,
        bmi,
        country: data.country,
        photoUrl: data.photoUrl,
        profileColor: data.profileColor,
        diabetesStatus: data.diabetesStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      onComplete();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 pb-20">
      <div className="max-w-2xl mx-auto px-6 pt-12 pb-8">
        
        {step === 2 ? (
          <button 
            type="button" 
            onClick={() => setStep(1)}
            className="mb-6 flex items-center text-gray-500 hover:text-gray-900 transition-colors font-medium"
          >
            <ArrowLeft size={20} className="mr-1" /> Back
          </button>
        ) : (
          <button 
            type="button" 
            onClick={() => auth.signOut()}
            className="mb-6 flex items-center text-gray-500 hover:text-gray-900 transition-colors font-medium"
          >
            <ArrowLeft size={20} className="mr-1" /> Back to Sign In
          </button>
        )}

        <div className="mb-10 text-center mt-4">
          <h1 className="text-[32px] font-display font-semibold mb-2 tracking-tight text-gray-900">Complete your profile</h1>
          <p className="text-gray-500 text-[15px]">Let's set up your personalized health experience.</p>
        </div>

        {error && <div className="p-4 mb-8 text-[15px] text-red-600 bg-red-50 rounded-2xl border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {step === 1 && (
            <div className="bg-gray-50/70 rounded-[28px] p-6 sm:p-8 border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-xl font-semibold mb-8 text-gray-900 tracking-tight">Personal Information</h2>
              
              <div className="flex flex-col items-center mb-10">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageChange} 
                  className="hidden" 
                  accept="image/*" 
                />
                
                <div 
                  className="relative w-[120px] h-[120px] cursor-pointer group" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  {data.photoUrl ? (
                    <img src={data.photoUrl} alt="Profile" className="w-full h-full rounded-full object-cover border-4 border-white shadow-sm" />
                  ) : (
                    <div 
                      className="w-full h-full rounded-full flex items-center justify-center border-4 border-white shadow-sm text-white transition-transform group-hover:scale-[1.02]" 
                      style={{ backgroundColor: data.profileColor || '#3b82f6' }}
                    >
                      <User size={48} />
                    </div>
                  )}
                  
                  {uploading && (
                    <div className="absolute inset-0 bg-white/60 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  <div className="absolute bottom-1 right-1 bg-white text-gray-700 p-2.5 rounded-full shadow-md border border-gray-100 group-hover:scale-110 transition-transform">
                    <Camera size={18} />
                  </div>
                </div>
                
                {!data.photoUrl && (
                  <p className="text-[15px] text-gray-500 mt-4 font-medium cursor-pointer hover:text-gray-700 transition-colors" onClick={() => fileInputRef.current?.click()}>
                    Tap to add a photo
                  </p>
                )}
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-[15px] font-medium text-gray-700 mb-2 ml-1">Full Name</label>
                  <input 
                    required 
                    type="text" 
                    value={data.name} 
                    onChange={e => setData({...data, name: e.target.value})} 
                    className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all text-gray-900 text-[15px]" 
                    placeholder="John Doe"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[15px] font-medium text-gray-700 mb-2 ml-1">Age</label>
                    <input 
                      required 
                      type="number" 
                      min={1} 
                      max={120} 
                      value={data.age} 
                      onChange={e => setData({...data, age: e.target.value})} 
                      className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all text-gray-900 text-[15px]" 
                      placeholder="e.g. 35"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[15px] font-medium text-gray-700 mb-2 ml-1">Gender</label>
                    <select 
                      value={data.gender} 
                      onChange={e => setData({...data, gender: e.target.value})} 
                      className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all text-gray-900 appearance-none text-[15px]"
                    >
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                      <option>Prefer not to say</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-gray-50/70 rounded-[28px] p-6 sm:p-8 border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-xl font-semibold mb-6 text-gray-900 tracking-tight">Health Information</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[15px] font-medium text-gray-700 mb-2 ml-1">Height (cm)</label>
                    <input 
                      required 
                      type="number" 
                      step="0.1" 
                      value={data.height} 
                      onChange={e => setData({...data, height: e.target.value})} 
                      className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all text-gray-900 text-[15px]" 
                      placeholder="170"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[15px] font-medium text-gray-700 mb-2 ml-1">Weight (kg)</label>
                    <input 
                      required 
                      type="number" 
                      step="0.1" 
                      value={data.weight} 
                      onChange={e => setData({...data, weight: e.target.value})} 
                      className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all text-gray-900 text-[15px]" 
                      placeholder="70"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-[15px] font-medium text-gray-700 mb-2 ml-1">Country</label>
                  <input 
                    type="text" 
                    value={data.country} 
                    onChange={e => setData({...data, country: e.target.value})} 
                    className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all text-gray-900 text-[15px]" 
                    placeholder="Where are you located?"
                  />
                </div>

                <div>
                  <label className="block text-[15px] font-medium text-gray-700 mb-3 ml-1">Diabetes Status</label>
                  <div className="flex flex-wrap gap-2.5">
                    {['No Diabetes', 'Prediabetes', 'Diabetes'].map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setData({ ...data, diabetesStatus: status })}
                        className={`px-5 py-3 rounded-2xl text-[15px] font-medium transition-all ${
                          data.diabetesStatus === status 
                            ? 'bg-gray-900 text-white shadow-md' 
                            : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={
              uploading || 
              (step === 1 && (!data.name || !data.age)) || 
              (step === 2 && (loading || !data.height || !data.weight))
            } 
            className="w-full py-4 mt-8 bg-gray-900 hover:bg-black text-white font-semibold rounded-2xl transition-all shadow-lg shadow-gray-900/20 disabled:opacity-50 disabled:shadow-none text-lg tracking-wide"
          >
            {step === 1 ? 'Continue' : (loading ? 'Saving...' : 'Complete Profile')}
          </button>
        </form>
      </div>
    </div>
  );
}
