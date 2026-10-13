import { Bell, ChevronRight, Droplet, MessageCircle, MessageSquare, Scale } from "lucide-react";
import { FeedbackWidget } from "../FeedbackWidget";

interface Props {
  diabetesStatus: string;
  whatsappLabel: string;
  whatsappConnected: boolean;
  onDiabetes: () => void;
  onWhatsApp: () => void;
  onNotifications: () => void;
  onLegal: () => void;
}

export function SettingsSection({
  diabetesStatus,
  whatsappLabel,
  whatsappConnected,
  onDiabetes,
  onWhatsApp,
  onNotifications,
  onLegal,
}: Props) {
  return (
    <div className="bg-neutral-50 rounded-2xl p-1.5 flex flex-col gap-0.5 border border-neutral-100/50 shadow-sm mt-1">
      <div
        onClick={onDiabetes}
        className="flex justify-between items-center px-3 py-2 cursor-pointer hover:bg-white rounded-xl transition-colors active:scale-[0.98]"
      >
        <div className="flex items-center gap-2.5 text-neutral-900">
          <div className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
            <Droplet size={14} className="fill-red-500" />
          </div>
          <span className="text-[13px] font-medium">Glucose</span>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-neutral-500">
          {diabetesStatus}
          <ChevronRight size={14} />
        </div>
      </div>

      <div
        onClick={onWhatsApp}
        className="flex justify-between items-center px-3 py-2.5 cursor-pointer hover:bg-white rounded-xl transition-colors active:scale-[0.98]"
      >
        <div className="flex items-center gap-2.5 text-neutral-900">
          <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <MessageCircle size={14} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[13px] font-medium leading-tight">WhatsApp Sync</span>
            <span className="text-[10px] text-neutral-500">{whatsappLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {whatsappConnected ? <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> : null}
          <ChevronRight size={14} className="text-neutral-400" />
        </div>
      </div>

      <div
        onClick={onNotifications}
        className="flex justify-between items-center px-3 py-2.5 cursor-pointer hover:bg-white rounded-xl transition-colors active:scale-[0.98]"
      >
        <div className="flex items-center gap-2.5 text-neutral-900">
          <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Bell size={14} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[13px] font-medium leading-tight">Notifications</span>
            <span className="text-[10px] text-neutral-500">Browser nudge on this device</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ChevronRight size={14} className="text-neutral-400" />
        </div>
      </div>

      <FeedbackWidget
        trigger={
          <div className="flex justify-between items-center px-3 py-2.5 cursor-pointer hover:bg-white rounded-xl transition-colors active:scale-[0.98]">
            <div className="flex items-center gap-2.5 text-neutral-900">
              <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <MessageSquare size={14} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[13px] font-medium leading-tight">Talk to Us</span>
                <span className="text-[10px] text-neutral-500">Feedback, feature ideas & help</span>
              </div>
            </div>
            <ChevronRight size={14} className="text-neutral-400" />
          </div>
        }
      />

      <div
        onClick={onLegal}
        className="flex justify-between items-center px-3 py-2.5 cursor-pointer hover:bg-white rounded-xl transition-colors active:scale-[0.98]"
      >
        <div className="flex items-center gap-2.5 text-neutral-900">
          <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Scale size={14} />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[13px] font-medium leading-tight">Legal & Disclaimers</span>
            <span className="text-[10px] text-neutral-500">Terms, Privacy, AI & Medical</span>
          </div>
        </div>
        <ChevronRight size={14} className="text-neutral-400" />
      </div>
    </div>
  );
}
