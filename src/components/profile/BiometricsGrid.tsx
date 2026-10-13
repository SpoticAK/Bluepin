import type { UserProfile } from "../../types";

export type ProfileEditField = keyof UserProfile;

interface Props {
  profile: UserProfile;
  onEdit: (field: ProfileEditField, value: unknown) => void;
}

function StatBox({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-neutral-100 p-2 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-50 transition-colors active:scale-95 shadow-sm"
    >
      <span className="text-[11px] text-neutral-500 font-medium mb-0.5">{label}</span>
      <span className="text-[13px] font-semibold text-neutral-900">{value}</span>
    </div>
  );
}

export function BiometricsGrid({ profile, onEdit }: Props) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      <StatBox
        label="Age"
        value={profile.age ? profile.age.toString() : "-"}
        onClick={() => onEdit("age", profile.age)}
      />
      <StatBox
        label="Gender"
        value={profile.gender ? profile.gender.charAt(0).toUpperCase() : "-"}
        onClick={() => onEdit("gender", profile.gender)}
      />
      <StatBox
        label="Height"
        value={profile.heightCm ? `${profile.heightCm}cm` : "-"}
        onClick={() => onEdit("heightCm", profile.heightCm)}
      />
      <StatBox
        label="Weight"
        value={profile.weight ? `${profile.weight}kg` : "-"}
        onClick={() => onEdit("weight", profile.weight)}
      />
    </div>
  );
}
