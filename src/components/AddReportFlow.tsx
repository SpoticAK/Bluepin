import { auth, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../store';
import { LabReport } from '../types';
import { UploadCloud, Loader2, X, File as FileIcon, CheckCircle2, Circle, FileSearch } from 'lucide-react';
import { cn, safeFormat } from '../lib/utils';
import { calculateStatus } from '../lib/biomarkerUtils';
import { DnaLoader } from './DnaLoader';

export function AddReportFlow({ onClose, onSuccess }: { onClose: () => void, onSuccess?: () => void }) {
  const { addLabReport } = useAppStore();
  const [file, setFile] = useState<File | null>(null);
  const [reportName, setReportName] = useState('');
  const [reportDate, setReportDate] = useState(safeFormat(new Date(), 'yyyy-MM-dd'));
    const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadPhase, setUploadPhase] = useState<'uploading' | 'scanning' | 'extracting' | 'finalizing'>('uploading');
  const [simulatedBiomarkers, setSimulatedBiomarkers] = useState<{name: string, status: 'pending'|'done'}[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (uploadPhase === 'extracting') {
      const coreBiomarkers = [
        "Hemoglobin", "Total Cholesterol", "Vitamin D", "Glucose", 
        "Creatinine", "White Blood Cells"
      ];
      let currentIndex = 0;
      setSimulatedBiomarkers(coreBiomarkers.map(b => ({ name: b, status: 'pending' })));

      const interval = setInterval(() => {
        setSimulatedBiomarkers(prev => {
          const next = [...prev];
          if (currentIndex < next.length) {
            next[currentIndex].status = 'done';
            currentIndex++;
          } else {
            setUploadPhase('finalizing');
            clearInterval(interval);
          }
          return next;
        });
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [uploadPhase]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      setFile(f);
      if (!reportName) {
        setReportName(f.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  
  
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      if (!reportName) {
        setReportName(f.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const processFile = async () => {
    if (!file || !reportName.trim() || !reportDate) return;
    setIsUploading(true);
    setUploadStatus('Initializing upload...');
    setErrorMsg(null);
    try {
      const getBase64 = (f: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = e => reject(e);
      });
      const base64Str = await getBase64(file);
      const chunkSize = 8 * 1024 * 1024;
      const totalChunks = Math.ceil(base64Str.length / chunkSize);
      const uploadId = uuidv4();
      let data: any = null;
      let downloadUrl = "";
      try {
        
        
        const uid = auth.currentUser?.uid;
        if (uid) {
          const fileRef = ref(storage, `users/${uid}/labReports/${uuidv4()}_${file.name}`);
          await uploadBytes(fileRef, file);
          downloadUrl = await getDownloadURL(fileRef);
        }
      } catch (storageErr) {
        if (file.size < 700 * 1024) {
          downloadUrl = `data:${file.type};base64,${base64Str}`;
        }
      }
      setUploadPhase('uploading');
      let detectedMimeType = file.type;
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'pdf') detectedMimeType = 'application/pdf';
      else if (ext === 'png') detectedMimeType = 'image/png';
      else if (ext === 'jpg' || ext === 'jpeg') detectedMimeType = 'image/jpeg';
      else if (!detectedMimeType) detectedMimeType = 'application/pdf';

      for (let i = 0; i < totalChunks; i++) {
        if (i === totalChunks - 1) {
          setUploadPhase('scanning');
          setUploadStatus('Reading medical document context...');
          
          let aiMessageIndex = 0;
          const aiMessages = [
            'Extracting key biomarkers...',
            'Analyzing clinical values...',
            'Formatting health insights...',
            'Comparing against standard ranges...',
            'Finalizing report parameters...'
          ];
          
          setTimeout(() => {
            setUploadPhase('extracting');
            setUploadStatus(aiMessages[0]);
            
            // Start rotating messages every 6 seconds
            const rotateInterval = setInterval(() => {
              aiMessageIndex = (aiMessageIndex + 1) % aiMessages.length;
              setUploadStatus(aiMessages[aiMessageIndex]);
            }, 6000);
            
            // Attach interval to window so we can clear it
            window.__uploadInterval = rotateInterval;
          }, 2500);
        } else {
          setUploadStatus(`Uploading securely (${Math.round(((i + 1) / totalChunks) * 100)}%)...`);
        }
        const chunkData = base64Str.slice(i * chunkSize, (i + 1) * chunkSize);
        const res = await fetch('/api/upload-chunk', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId, chunkIndex: i, totalChunks, chunkData, mimeType: detectedMimeType, type: 'lab-report' })
        });
        if (!res.ok) {
          const text = await res.text();
          let parsed;
          try { parsed = JSON.parse(text); } catch (e) {}
          const errDetails = typeof parsed?.details === 'object' ? JSON.stringify(parsed.details) : parsed?.details;
          throw new Error(parsed?.error || errDetails || text || `HTTP Error ${res.status}`);
        }
        const resData = await res.json();
        if (i === totalChunks - 1) data = resData;
      }
      
      if (window.__uploadInterval) clearInterval(window.__uploadInterval);
      if (data?.success && data.biomarkers && data.biomarkers.length > 0) {
        const extractedBiomarkers = data.biomarkers.map((b: any) => {
          const statusResult = calculateStatus(b.biomarkerId || b.name, b.value, b.refMin, b.refMax, b.status, b.refRangeText);
          return {
            id: uuidv4(),
            name: b.name,
            originalName: b.originalName,
            biomarkerId: b.biomarkerId,
            category: b.category,
            confidence: b.confidence,
            matchedBy: b.matchedBy,
            value: b.value,
            unit: b.unit,
            refMin: b.refMin,
            refMax: b.refMax,
            refRangeText: b.refRangeText,
            status: statusResult.status || b.status,
            info: statusResult.info || b.info
          };
        }).filter(Boolean);

        const report: LabReport = {
          id: uuidv4(),
          name: reportName.trim(),
          fileUrl: downloadUrl,
          date: reportDate,
          reportType: data.reportType,
          specimenType: data.specimenType,
          biomarkers: extractedBiomarkers,
          createdAt: Date.now()
        };
        addLabReport(report);
        if (onSuccess) onSuccess();
        else onClose();
      } else {
        setErrorMsg(data?.errorMsg || data?.error || "Could not extract any lab results from this file.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload and process document.");
    } finally {
      setIsUploading(false);
    }
  };

  const isFormComplete = file !== null && reportName.trim().length > 0 && reportDate !== '';

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-theme-text/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div 
          className="bg-theme-card max-w-md w-full rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
        >
          {isUploading ? (
            <div className="p-8 flex flex-col items-center justify-center min-h-[350px] relative">
              <DnaLoader className="mb-8 scale-110" />
              <h3 className="text-[22px] font-bold text-theme-text mb-2 text-center">
                {uploadPhase === 'uploading' && 'Uploading Securely'}
                {uploadPhase === 'scanning' && 'Scanning Content'}
                {uploadPhase === 'extracting' && 'Extracting Biomarkers'}
                {uploadPhase === 'finalizing' && 'Finalizing Results'}
              </h3>
              <p className="text-theme-text-sec text-sm mb-6 text-center">{uploadStatus}</p>

              <div className="w-full max-w-[240px] space-y-3 mt-2">
                {simulatedBiomarkers.map((b, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationFillMode: 'both' }}>
                    <span className={b.status === 'done' ? 'text-theme-text font-medium' : 'text-theme-text-sec'}>
                      {b.name}
                    </span>
                    {b.status === 'done' ? (
                      <CheckCircle2 size={16} className="text-emerald-500 animate-in zoom-in duration-300" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-theme-border/50 animate-pulse" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : errorMsg ? (
            <div className="p-8 text-center min-h-[300px] flex flex-col items-center justify-center relative">
              <button onClick={onClose} className="absolute top-4 right-4 p-2 text-theme-text-sec hover:text-theme-text transition-colors">
                <X size={24} />
              </button>
              <h3 className="text-xl font-bold text-theme-text mb-2">Upload Failed</h3>
              <p className="text-theme-text-sec text-sm mb-2">{typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg}</p>
              <p className="text-theme-text-sec text-xs mb-6">
                Allowed formats: PDF, PNG, JPEG, JPG.<br/>
                Maximum file size: 10 MB.
              </p>
              <button onClick={() => setErrorMsg(null)} className="w-full py-3 bg-theme-accent text-white font-bold rounded-xl">Try Again</button>
            </div>
          ) : (
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[22px] font-display font-medium text-theme-text">Add Health Report</h3>
                <button onClick={onClose} className="p-2 -mr-2 text-theme-text-sec hover:text-theme-text transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-5">
                {/* File Upload Zone */}
                <div>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/png, image/jpeg, image/jpg, application/pdf"
                    className="hidden" 
                    onChange={handleFileChange} 
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "w-full h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors text-center px-4",
                      isDragging 
                        ? "border-theme-accent bg-theme-accent/5" 
                        : file 
                          ? "border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10" 
                          : "border-theme-border/60 hover:bg-theme-card-sec/50 bg-theme-card-sec"
                    )}
                  >
                    {file ? (
                      <>
                        <FileIcon size={32} className="text-emerald-500 mb-2" />
                        <span className="text-sm font-medium text-theme-text truncate w-full max-w-[200px]">{file.name}</span>
                        <span className="text-xs text-theme-text-sec mt-0.5">Click to change file</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={32} className="text-theme-text-sec mb-2" />
                        <span className="text-sm font-medium text-theme-text">Upload file here</span>
                        <span className="text-xs text-theme-text-sec mt-0.5">Drag and drop or choose a PDF/Image</span>
                        <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); if(fileInputRef.current){ fileInputRef.current.accept = 'image/*,application/pdf'; fileInputRef.current.click(); } }}
                            className="px-8 py-3 bg-theme-accent text-white text-base font-bold rounded-xl hover:bg-theme-accent/90 shadow-lg shadow-theme-accent/30 transition-all transform hover:scale-105"
                          >
                            Upload Report
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Form Fields */}
                <div>
                  <label className="block text-xs font-bold text-theme-text-sec mb-1.5 ml-1 uppercase tracking-wider">Lab / Report Name</label>
                  <input 
                    type="text" 
                    value={reportName} 
                    onChange={(e) => setReportName(e.target.value)} 
                    className="w-full bg-theme-bg border border-theme-border text-theme-text text-base px-4 py-3 rounded-xl focus:ring-2 focus:ring-theme-accent outline-none" 
                    placeholder="e.g. Full Body Checkup" 
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-theme-text-sec mb-1.5 ml-1 uppercase tracking-wider">Report Date</label>
                  <input 
                    type="date" 
                    value={reportDate} 
                    onChange={(e) => setReportDate(e.target.value)} 
                    className="w-full bg-theme-bg border border-theme-border text-theme-text text-base px-4 py-3 rounded-xl focus:ring-2 focus:ring-theme-accent outline-none" 
                  />
                </div>
              </div>
              <div className="mt-8 space-y-4">
                <div className="bg-theme-bg p-3 rounded-lg border border-theme-border/50">
                  <p className="text-[11px] text-theme-text-sec leading-relaxed text-center">
                    By uploading this report, you confirm that you have the right to upload it and consent to its processing in accordance with our Privacy Policy.
                  </p>
                </div>
                <button 
                  onClick={processFile} 
                  disabled={!isFormComplete || isUploading}
                  className="w-full py-4 bg-gradient-to-r from-theme-accent to-theme-accent/80 disabled:opacity-50 disabled:from-theme-border disabled:to-theme-border text-white font-bold rounded-xl transition-all shadow-lg shadow-theme-accent/20 active:scale-[0.98] flex justify-center items-center gap-2"
                >
                  {isUploading ? <Loader2 className="animate-spin" size={20} /> : "Confirm"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
