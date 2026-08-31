import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

declare global {
  interface Window {
    dataLayer: any[];
  }
}

export function trackEvent(eventName: string, params: Record<string, any> = {}) {
  try {
    if (typeof window !== "undefined") {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: eventName,
        ...params,
      });
    }
  } catch (err) {
    console.error("Failed to track event:", err);
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

export function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi >= 18.5 && bmi < 23) return "Normal weight";
  if (bmi >= 23 && bmi < 27.5) return "Overweight";
  return "Obese";
}

import { parseISO, format, isValid } from 'date-fns';

export function safeFormat(dateStr: string | Date | undefined | null, formatStr: string): string {
  if (!dateStr) return '';
  try {
    let d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    if (typeof dateStr === 'string' && !isValid(d)) {
      d = new Date(dateStr);
    }
    if (isValid(d)) {
      return format(d, formatStr);
    }
    return '';
  } catch (e) {
    return '';
  }
}

export const downloadFile = (fileUrl: string, date: string) => {
  try {
    if (fileUrl.startsWith('data:')) {
      const arr = fileUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/pdf';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], {type: mime});
      const downloadUrl = URL.createObjectURL(blob);
      const extension = mime.includes('pdf') ? 'pdf' : (mime.includes('png') ? 'png' : 'jpg');
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Lab_Report_${date}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
    } else {
      // Remote URL: open immediately to avoid popup blockers blocking async window.open
      window.open(fileUrl, '_blank');
    }
  } catch (err) {
    console.error("Error downloading file:", err);
  }
};
