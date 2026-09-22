export type GlucoseTiming = "Fasting" | "Post-Prandial" | "Random";

export interface PendingGlucoseReading {
  uid: string;
  readingId: string;
  value: number;
  unit: string;
  date: string;
  time: string;
  createdAt: any;
}

export interface BiomarkerItem {
  name: string;
  value: number | string | null;
  rawValue?: string;
  unit?: string;
  status?: string;
}

export interface ExtractedReportResult {
  success: boolean;
  reportType?: string;
  specimenType?: string;
  biomarkers?: BiomarkerItem[];
  error?: string;
}

export interface LinkAccountResult {
  success: boolean;
  message: string;
  uid?: string;
}

export interface InteractiveButton {
  id: string;
  title: string;
}
