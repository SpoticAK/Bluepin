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
  /** Only set on failure — success is confirmed by the caller sending a greeting. */
  message?: string;
  uid?: string;
}

export interface InteractiveButton {
  id: string;
  title: string;
}

/* ─── Meta webhook payload shapes ─────────────────────────────────────────── */

export interface MetaMediaObject {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
  filename?: string;
}

export interface MetaInteractiveObject {
  type: string;
  button_reply?: { id: string; title: string };
  list_reply?: { id: string; title: string; description?: string };
}

export interface MetaMessageObject {
  id?: string;
  from: string;
  timestamp?: string;
  type: string;
  text?: { body: string };
  image?: MetaMediaObject;
  document?: MetaMediaObject;
  interactive?: MetaInteractiveObject;
}

export interface MetaChangeValue {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  messages?: MetaMessageObject[];
  statuses?: unknown[];
  errors?: unknown[];
}

export interface MetaChange {
  field?: string;
  value?: MetaChangeValue;
}

export interface MetaEntry {
  id?: string;
  changes?: MetaChange[];
}

export interface MetaWebhookBody {
  object?: string;
  entry?: MetaEntry[];
}
