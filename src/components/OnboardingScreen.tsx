import React, { useState, useRef } from 'react';
import { auth, db, storage } from '../lib/firebase';
import { User, Camera, ArrowLeft } from 'lucide-react';
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
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
    diabetesStatus: 'No'
  });
  
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
    <div className="min-h-[100dvh] bg-white text-gray-900 pb-10 flex flex-col items-center justify-center">
      <div className="w-full max-w-md px-6 pt-8 pb-6">
        
        <button 
          type="button" 
          onClick={() => auth.signOut()}
          className="mb-4 flex items-center text-gray-500 hover:text-gray-900 transition-colors font-medium text-sm"
        >
          <ArrowLeft size={18} className="mr-1" /> Back to Sign In
        </button>

        <div className="mb-6 text-left">
          <h1 className="text-3xl font-display font-semibold tracking-tight text-gray-900 flex items-center gap-2">
            Complete your profile <span>👋</span>
          </h1>
        </div>

        {error && <div className="p-4 mb-6 text-[15px] text-red-600 bg-red-50 rounded-2xl border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-gray-50/70 rounded-3xl p-5 sm:p-6 border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            <div className="flex flex-col items-center mb-6">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageChange} 
                className="hidden" 
                accept="image/*" 
              />
              
              <div 
                className="relative w-24 h-24 cursor-pointer group" 
                onClick={() => fileInputRef.current?.click()}
              >
                {data.photoUrl ? (
                  <img src={data.photoUrl} alt="Profile" className="w-full h-full rounded-full object-cover border-[3px] border-white shadow-sm" />
                ) : (
                  <div 
                    className="w-full h-full rounded-full flex items-center justify-center border-[3px] border-white shadow-sm text-white transition-transform group-hover:scale-[1.02]" 
                    style={{ backgroundColor: data.profileColor || '#3b82f6' }}
                  >
                    <User size={36} />
                  </div>
                )}
                
                {uploading && (
                  <div className="absolute inset-0 bg-white/60 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                <div className="absolute bottom-0 right-0 bg-white text-gray-700 p-2 rounded-full shadow-md border border-gray-100 group-hover:scale-110 transition-transform">
                  <Camera size={16} />
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Full Name</label>
                <input 
                  required 
                  type="text" 
                  value={data.name} 
                  onChange={e => setData({...data, name: e.target.value})} 
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all text-gray-900 text-sm" 
                  placeholder="John Doe"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Age</label>
                  <input 
                    required 
                    type="number" 
                    min={1} 
                    max={120} 
                    value={data.age} 
                    onChange={e => setData({...data, age: e.target.value})} 
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all text-gray-900 text-sm" 
                    placeholder="e.g. 35"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Height (cm)</label>
                  <input 
                    required 
                    type="number" 
                    step="0.1" 
                    value={data.height} 
                    onChange={e => setData({...data, height: e.target.value})} 
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all text-gray-900 text-sm" 
                    placeholder="170"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Weight (kg)</label>
                  <input 
                    required 
                    type="number" 
                    step="0.1" 
                    value={data.weight} 
                    onChange={e => setData({...data, weight: e.target.value})} 
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all text-gray-900 text-sm" 
                    placeholder="70"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 ml-1 mt-2">Diabetic Status</label>
                <div className="flex gap-2">
                  {['No', 'Pre diabetes', 'Yes'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setData({ ...data, diabetesStatus: status })}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
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

          <button 
            type="submit" 
            disabled={uploading || loading || !data.name || !data.age || !data.height || !data.weight} 
            className="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-medium rounded-xl transition-all shadow-lg shadow-gray-900/20 disabled:opacity-50 disabled:shadow-none text-base"
          >
            {loading ? 'Saving...' : 'Complete Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
