import { Camera, User as UserIcon } from "lucide-react";
import type { User } from "firebase/auth";
import type { UserProfile } from "../../types";
import { cn } from "../../lib/utils";

interface Props {
  user: User | null;
  profile: UserProfile;
  onEditName: () => void;
  onEditPhoto: () => void;
}

export function ProfileHeader({
  user,
  profile,
  onEditName,
  onEditPhoto,
}: Props) {
  const contact =
    user?.email ||
    user?.phoneNumber ||
    profile?.phoneNumber ||
    "No contact provided";

  return (
    <div className="p-4 pb-2 flex flex-col items-center">
      <div
        className="relative mb-2 cursor-pointer group mt-2"
        onClick={onEditPhoto}
      >
        <div
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-medium shadow-sm overflow-hidden",
            !user?.photoURL && (profile.profileColor || "bg-[#1A73E8]"),
          )}
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt="Profile"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : profile.name ? (
            profile.name.charAt(0).toUpperCase()
          ) : (
            <UserIcon size={28} />
          )}
        </div>
        <div className="absolute inset-0 bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-[2px]">
          <Camera size={16} className="text-white" />
        </div>
      </div>

      <div className="text-center w-full px-4">
        <h2
          onClick={onEditName}
          className="text-[17px] font-bold text-neutral-900 mb-0.5 cursor-pointer hover:opacity-70 transition-opacity truncate"
          style={{ fontFamily: "Garet, sans-serif" }}
        >
          {profile.name || "Anonymous User"}
        </h2>
        <p className="text-neutral-500 text-[11px] truncate max-w-50 mx-auto">
          {contact}
        </p>
      </div>
    </div>
  );
}
