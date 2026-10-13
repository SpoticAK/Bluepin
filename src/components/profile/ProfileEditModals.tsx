import { ChevronLeft } from "lucide-react";
import { cn } from "../../lib/utils";

function ModalShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      onClick={onBack}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center p-4 border-b border-neutral-100 bg-neutral-50/50">
          <button
            onClick={onBack}
            className="mr-2 text-neutral-500 hover:text-neutral-900 transition-colors p-1"
          >
            <ChevronLeft size={20} />
          </button>
          <h3 className="text-[15px] font-semibold text-neutral-900 capitalize">
            {title}
          </h3>
        </div>
        <div className="p-5 bg-white">{children}</div>
      </div>
    </div>
  );
}

export function GenericEditModal({
  title,
  value,
  isNumber,
  onChange,
  onSave,
  onBack,
}: {
  title: string;
  value: string;
  isNumber: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  onBack: () => void;
}) {
  return (
    <ModalShell title={title} onBack={onBack}>
      <input
        type={isNumber ? "number" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-neutral-900 focus:outline-none focus:border-blue-500 mb-4 text-sm"
        autoFocus
      />
      <button
        onClick={onSave}
        className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-[14px] py-3 rounded-xl transition-all shadow-[0_4px_12px_-4px_rgba(26,115,232,0.4)]"
      >
        Save
      </button>
    </ModalShell>
  );
}

const DIABETES_OPTIONS = ["No", "Pre diabetes", "Yes"] as const;

export function DiabetesStatusModal({
  value,
  onSelect,
  onBack,
}: {
  value?: string;
  onSelect: (status: (typeof DIABETES_OPTIONS)[number]) => void;
  onBack: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      onClick={onBack}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center p-4 border-b border-neutral-100 bg-neutral-50/50">
          <button
            onClick={onBack}
            className="mr-2 text-neutral-500 hover:text-neutral-900 transition-colors p-1"
          >
            <ChevronLeft size={20} />
          </button>
          <h3 className="text-[15px] font-semibold text-neutral-900">
            Diabetes Status
          </h3>
        </div>
        <div className="p-5 bg-white flex flex-col gap-2">
          {DIABETES_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => onSelect(status)}
              className={cn(
                "w-full py-3 px-4 rounded-xl text-sm font-medium transition-all text-left",
                value === status
                  ? "bg-neutral-900 text-white shadow-md"
                  : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300",
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
