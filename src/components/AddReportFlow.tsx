import { auth, storage } from "../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useReducer,
  useCallback,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { useAppStore } from "../store";
import { LabReport } from "../types";
import {
  UploadCloud,
  Loader2,
  X,
  File as FileIcon,
  CheckCircle2,
} from "lucide-react";
import { cn, safeFormat } from "../lib/utils";
import { calculateStatus } from "../lib/biomarkerUtils";
import { DnaLoader } from "./DnaLoader";

// ─── Constants ────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 8 * 1024 * 1024;

const CORE_BIOMARKERS = [
  "Hemoglobin",
  "Total Cholesterol",
  "Vitamin D",
  "Glucose",
  "Creatinine",
  "White Blood Cells",
];

const AI_MESSAGES = [
  "Extracting key biomarkers...",
  "Analyzing clinical values...",
  "Formatting health insights...",
  "Comparing against standard ranges...",
  "Finalizing report parameters...",
];

// ─── Upload State Machine ─────────────────────────────────────────────────────

type UploadPhase = "uploading" | "scanning" | "extracting" | "finalizing";

interface SimulatedBiomarker {
  name: string;
  status: "pending" | "done";
}

interface UploadState {
  phase: UploadPhase;
  statusMessage: string;
  simulatedBiomarkers: SimulatedBiomarker[];
}

type UploadAction =
  | { type: "SET_PHASE"; phase: UploadPhase; message?: string }
  | { type: "SET_STATUS"; message: string }
  | { type: "INIT_BIOMARKERS"; names: string[] }
  | { type: "MARK_BIOMARKER_DONE"; index: number };

const INITIAL_UPLOAD_STATE: UploadState = {
  phase: "uploading",
  statusMessage: "Initializing upload...",
  simulatedBiomarkers: [],
};

function uploadReducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case "SET_PHASE":
      return {
        ...state,
        phase: action.phase,
        statusMessage: action.message ?? state.statusMessage,
      };
    case "SET_STATUS":
      return { ...state, statusMessage: action.message };
    case "INIT_BIOMARKERS":
      return {
        ...state,
        simulatedBiomarkers: action.names.map((name) => ({
          name,
          status: "pending",
        })),
      };
    case "MARK_BIOMARKER_DONE":
      // Fix #1: creates new objects instead of mutating existing ones
      return {
        ...state,
        simulatedBiomarkers: state.simulatedBiomarkers.map((b, i) =>
          i === action.index ? { ...b, status: "done" } : b,
        ),
      };
    default:
      return state;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Fix #10: rejects with a proper Error instead of a raw ProgressEvent
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () =>
      reject(new Error("Failed to read file. Please try again."));
  });
}

// Fix (de-duplicated MIME logic)
function detectMimeType(file: File): string {
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return file.type || "application/pdf";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddReportFlow({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { addLabReport } = useAppStore();

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [reportName, setReportName] = useState("");
  const [reportDate, setReportDate] = useState(
    safeFormat(new Date(), "yyyy-MM-dd"),
  );
  const [isDragging, setIsDragging] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadState, dispatchUpload] = useReducer(
    uploadReducer,
    INITIAL_UPLOAD_STATE,
  );

  // Fix #2, #3, #4: all timers live in refs, never on window
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const biomarkerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const isMountedRef = useRef(true);

  // Fix #7: detect touch devices to suppress drag-and-drop UI
  const isTouchDevice = useMemo(
    () =>
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0),
    [],
  );

  // Fix #4: full cleanup on unmount — cancels fetch, clears all timers
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      if (rotateIntervalRef.current) clearInterval(rotateIntervalRef.current);
      if (biomarkerIntervalRef.current)
        clearInterval(biomarkerIntervalRef.current);
    };
  }, []);

  // Biomarker animation — triggered by reducer phase, cleaned up properly
  useEffect(() => {
    if (uploadState.phase !== "extracting") return;

    dispatchUpload({ type: "INIT_BIOMARKERS", names: CORE_BIOMARKERS });
    let currentIndex = 0;

    biomarkerIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      if (currentIndex < CORE_BIOMARKERS.length) {
        dispatchUpload({
          type: "MARK_BIOMARKER_DONE",
          index: currentIndex,
        });
        currentIndex++;
      } else {
        dispatchUpload({ type: "SET_PHASE", phase: "finalizing" });
        if (biomarkerIntervalRef.current)
          clearInterval(biomarkerIntervalRef.current);
      }
    }, 1500);

    return () => {
      if (biomarkerIntervalRef.current)
        clearInterval(biomarkerIntervalRef.current);
    };
  }, [uploadState.phase]);

  // ── File Handlers ──────────────────────────────────────────────────────────

  const applyFile = useCallback((f: File) => {
    setFile(f);
    // Only auto-fill name if the user hasn't typed one yet
    setReportName((prev) => prev || f.name.replace(/\.[^/.]+$/, ""));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) applyFile(f);
    },
    [applyFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) applyFile(f);
      // Reset so the same file can be re-selected if needed
      e.target.value = "";
    },
    [applyFile],
  );

  // ── Upload ─────────────────────────────────────────────────────────────────

  const clearTimers = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    if (rotateIntervalRef.current) {
      clearInterval(rotateIntervalRef.current);
      rotateIntervalRef.current = null;
    }
  }, []);

  const processFile = async () => {
    if (!file || !reportName.trim() || !reportDate) return;

    // Fix #9: explicit empty-file guard
    if (file.size === 0) {
      setErrorMsg("The selected file appears to be empty.");
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    dispatchUpload({
      type: "SET_PHASE",
      phase: "uploading",
      message: "Initializing upload...",
    });

    // Fix (cancellable fetch): AbortController tied to this upload session
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    try {
      const base64Str = await readFileAsBase64(file);

      const totalChunks = Math.ceil(base64Str.length / CHUNK_SIZE);
      const uploadId = uuidv4();
      let downloadUrl = "";
      let data: any = null;

      // Firebase Storage — best-effort; non-fatal if it fails
      try {
        const uid = auth.currentUser?.uid;
        if (uid) {
          const fileRef = ref(
            storage,
            `users/${uid}/labReports/${uuidv4()}_${file.name}`,
          );
          await uploadBytes(fileRef, file);
          downloadUrl = await getDownloadURL(fileRef);
        }
      } catch {
        if (file.size < 700 * 1024) {
          downloadUrl = `data:${file.type};base64,${base64Str}`;
        }
      }

      const mimeType = detectMimeType(file);

      for (let i = 0; i < totalChunks; i++) {
        if (signal.aborted)
          throw new DOMException("Upload cancelled.", "AbortError");

        const isLastChunk = i === totalChunks - 1;

        if (isLastChunk) {
          dispatchUpload({
            type: "SET_PHASE",
            phase: "scanning",
            message: "Reading medical document context...",
          });

          // Fix #3: timeout ID is saved so it can be cleared on unmount
          scanTimeoutRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;

            let aiMessageIndex = 0;
            dispatchUpload({
              type: "SET_PHASE",
              phase: "extracting",
              message: AI_MESSAGES[0],
            });

            // Fix #2: stored in ref, never on window
            rotateIntervalRef.current = setInterval(() => {
              if (!isMountedRef.current) return;
              aiMessageIndex = (aiMessageIndex + 1) % AI_MESSAGES.length;
              dispatchUpload({
                type: "SET_STATUS",
                message: AI_MESSAGES[aiMessageIndex],
              });
            }, 6000);
          }, 2500);
        } else {
          dispatchUpload({
            type: "SET_STATUS",
            message: `Uploading securely (${Math.round(((i + 1) / totalChunks) * 100)}%)...`,
          });
        }

        const chunkData = base64Str.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const token = await auth.currentUser?.getIdToken();

        const res = await fetch("/api/upload-chunk", {
          method: "POST",
          signal, // makes this fetch cancellable
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uploadId,
            chunkIndex: i,
            totalChunks,
            chunkData,
            mimeType,
            type: "lab-report",
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          let parsed: any;
          try {
            parsed = JSON.parse(text);
          } catch {
            /* not JSON */
          }
          const details =
            typeof parsed?.details === "object"
              ? JSON.stringify(parsed.details)
              : parsed?.details;
          throw new Error(
            parsed?.error || details || text || `HTTP Error ${res.status}`,
          );
        }

        const resData = await res.json();
        if (isLastChunk) data = resData;
      }

      clearTimers();
      if (!isMountedRef.current) return;

      if (
        data?.success &&
        Array.isArray(data.biomarkers) &&
        data.biomarkers.length > 0
      ) {
        const extractedBiomarkers = data.biomarkers
          .map((b: any) => {
            const statusResult = calculateStatus(
              b.biomarkerId || b.name,
              b.value,
              b.refMin,
              b.refMax,
              b.status,
              b.refRangeText,
            );
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
              info: statusResult.info || b.info,
            };
          })
          .filter(Boolean);

        const report: LabReport = {
          id: uuidv4(),
          name: reportName.trim(),
          fileUrl: downloadUrl,
          date: reportDate,
          reportType: data.reportType,
          specimenType: data.specimenType,
          biomarkers: extractedBiomarkers,
          createdAt: Date.now(),
        };

        addLabReport(report);
        onSuccess ? onSuccess() : onClose();
      } else {
        setErrorMsg(
          data?.errorMsg ||
            data?.error ||
            "Could not extract any lab results from this file.",
        );
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      // Silently ignore intentional cancellations
      if (err.name === "AbortError") return;
      setErrorMsg(err.message || "Failed to upload and process document.");
    } finally {
      clearTimers();
      if (isMountedRef.current) setIsUploading(false);
    }
  };

  // Fix (optimization): memoized so it doesn't recalculate on every render
  const isFormComplete = useMemo(
    () => file !== null && reportName.trim().length > 0 && reportDate !== "",
    [file, reportName, reportDate],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const { phase, statusMessage, simulatedBiomarkers } = uploadState;

  return (
    <div className="fixed inset-0 z-60 bg-theme-text/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-theme-card max-w-md w-full rounded-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* ── Uploading Phase ────────────────────────────────────────────── */}
        {isUploading ? (
          <div className="p-8 flex flex-col items-center justify-center min-h-87.5 relative">
            <DnaLoader className="mb-8 scale-110" />
            <h3 className="text-[22px] font-bold text-theme-text mb-2 text-center">
              {phase === "uploading" && "Uploading Securely"}
              {phase === "scanning" && "Scanning Content"}
              {phase === "extracting" && "Extracting Biomarkers"}
              {phase === "finalizing" && "Finalizing Results"}
            </h3>
            <p className="text-theme-text-sec text-sm mb-6 text-center">
              {statusMessage}
            </p>
            <div className="w-full max-w-60 space-y-3 mt-2">
              {simulatedBiomarkers.map((b, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm animate-in fade-in slide-in-from-bottom-2 duration-500"
                  style={{ animationFillMode: "both" }}
                >
                  <span
                    className={
                      b.status === "done"
                        ? "text-theme-text font-medium"
                        : "text-theme-text-sec"
                    }
                  >
                    {b.name}
                  </span>
                  {b.status === "done" ? (
                    <CheckCircle2
                      size={16}
                      className="text-emerald-500 animate-in zoom-in duration-300"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-theme-border/50 animate-pulse" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : errorMsg ? (
          /* ── Error Phase ──────────────────────────────────────────────── */
          <div className="p-8 text-center min-h-75 flex flex-col items-center justify-center relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-theme-text-sec hover:text-theme-text transition-colors"
            >
              <X size={24} />
            </button>
            <h3 className="text-xl font-bold text-theme-text mb-2">
              Upload Failed
            </h3>
            <p className="text-theme-text-sec text-sm mb-2">
              {typeof errorMsg === "object"
                ? JSON.stringify(errorMsg)
                : errorMsg}
            </p>
            <p className="text-theme-text-sec text-xs mb-6">
              Allowed formats: PDF, PNG, JPEG, JPG.
              <br />
              Maximum file size: 10 MB.
            </p>
            <button
              onClick={() => setErrorMsg(null)}
              className="w-full py-3 bg-theme-accent text-white font-bold rounded-xl"
            >
              Try Again
            </button>
          </div>
        ) : (
          /* ── Form Phase ───────────────────────────────────────────────── */
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[22px] font-display font-medium text-theme-text">
                Add Health Report
              </h3>
              <button
                onClick={onClose}
                className="p-2 -mr-2 text-theme-text-sec hover:text-theme-text transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-5">
              {/* File Upload Zone */}
              <div>
                {/* Fix #5: no spaces in accept; Fix #6: no runtime accept mutation */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  // Fix #7: drag events only wired on non-touch devices
                  onDragOver={!isTouchDevice ? handleDragOver : undefined}
                  onDragLeave={!isTouchDevice ? handleDragLeave : undefined}
                  onDrop={!isTouchDevice ? handleDrop : undefined}
                  className={cn(
                    "w-full h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors text-center px-4",
                    isDragging
                      ? "border-theme-accent bg-theme-accent/5"
                      : file
                        ? "border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10"
                        : "border-theme-border/60 hover:bg-theme-card-sec/50 bg-theme-card-sec",
                  )}
                >
                  {file ? (
                    <>
                      <FileIcon size={32} className="text-emerald-500 mb-2" />
                      <span className="text-sm font-medium text-theme-text truncate w-full max-w-50">
                        {file.name}
                      </span>
                      <span className="text-xs text-theme-text-sec mt-0.5">
                        Click to change file
                      </span>
                    </>
                  ) : (
                    <>
                      <UploadCloud
                        size={32}
                        className="text-theme-text-sec mb-2"
                      />
                      <span className="text-sm font-medium text-theme-text">
                        Upload file here
                      </span>
                      {/* Fix #7: contextual hint per device type */}
                      <span className="text-xs text-theme-text-sec mt-0.5">
                        {isTouchDevice
                          ? "Tap to choose a PDF or Image"
                          : "Drag and drop or choose a PDF / Image"}
                      </span>
                      <div
                        className="flex gap-2 mt-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Fix #6: no accept mutation here — single source of truth
                            fileInputRef.current?.click();
                          }}
                          className="px-8 py-3 bg-theme-accent text-white text-base font-bold rounded-xl hover:bg-theme-accent/90 shadow-lg shadow-theme-accent/30 transition-all transform hover:scale-105"
                        >
                          Upload Report
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Report Name */}
              <div>
                <label className="block text-xs font-bold text-theme-text-sec mb-1.5 ml-1 uppercase tracking-wider">
                  Lab / Report Name
                </label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border text-theme-text text-base px-4 py-3 rounded-xl focus:ring-2 focus:ring-theme-accent outline-none"
                  placeholder="e.g. Full Body Checkup"
                />
              </div>

              {/* Report Date */}
              <div>
                <label className="block text-xs font-bold text-theme-text-sec mb-1.5 ml-1 uppercase tracking-wider">
                  Report Date
                </label>
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
                  By uploading this report, you confirm that you have the right
                  to upload it and consent to its processing in accordance with
                  our Privacy Policy.
                </p>
              </div>
              <button
                onClick={processFile}
                disabled={!isFormComplete || isUploading}
                className="w-full py-4 bg-linear-to-r from-theme-accent to-theme-accent/80 disabled:opacity-50 disabled:from-theme-border disabled:to-theme-border text-white font-bold rounded-xl transition-all shadow-lg shadow-theme-accent/20 active:scale-[0.98] flex justify-center items-center gap-2"
              >
                {isUploading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  "Confirm"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
