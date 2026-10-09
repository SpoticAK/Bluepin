import { cn } from "../../lib/utils";

type NavItemProps = {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  colorClass?: string;
  id?: string;
  dataTour?: string;
};

export function NavItem({
  icon,
  label,
  isActive,
  onClick,
  isCollapsed,
  colorClass,
  id,
  dataTour,
}: NavItemProps & { isCollapsed?: boolean }) {
  return (
    <button
      id={id}
      data-tour={dataTour}
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={cn(
        "w-full flex items-center space-x-3 py-3 rounded-xl transition-all duration-200 ease-in-out text-left",
        isCollapsed ? "justify-center px-0" : "px-4",
        isActive
          ? "bg-theme-card-sec text-theme-text font-medium"
          : "text-theme-text-sec hover:bg-theme-card-sec hover:text-theme-text",
      )}
    >
      <span
        className={cn(
          "transition-colors duration-300",
          isActive ? colorClass || "text-theme-text" : "text-theme-text-sec",
        )}
      >
        {icon}
      </span>
      {!isCollapsed && <span>{label}</span>}
    </button>
  );
}

export function MobileNavItem({
  icon,
  label,
  isActive,
  onClick,
  colorClass,
  id,
  dataTour,
}: NavItemProps) {
  return (
    <button
      id={id}
      data-tour={dataTour}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center space-y-1 w-16 py-1 transition-colors",
        isActive ? "text-theme-text" : "text-theme-text-sec",
      )}
    >
      <span
        className={cn(
          "transition-colors duration-300",
          isActive ? colorClass || "text-theme-text" : "text-theme-text-sec",
        )}
      >
        {icon}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
