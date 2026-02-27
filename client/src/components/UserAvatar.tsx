import { useState } from "react";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500",
  "bg-cyan-500", "bg-amber-500",
];

function getColorFromId(id: string | number): string {
  const str = String(id);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.charAt(0)?.toUpperCase() || "";
  const l = lastName?.charAt(0)?.toUpperCase() || "";
  return f + l || "?";
}

interface UserAvatarProps {
  userId: string | number;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
};

export function UserAvatar({ userId, firstName, lastName, photoUrl, size = "md", className }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(firstName, lastName);
  const colorClass = getColorFromId(userId);
  const sizeClass = sizeClasses[size];

  const imgSrc = photoUrl || `/api/users/${userId}/profile-photo`;

  if (!imgError) {
    return (
      <img
        src={imgSrc}
        alt={`${firstName || ""} ${lastName || ""}`.trim() || "Avatar"}
        className={cn("rounded-full object-cover shrink-0 ring-2 ring-[#5ADBFA]/30 ring-offset-1 ring-offset-background", sizeClass, className)}
        onError={() => setImgError(true)}
        data-testid={`avatar-${userId}`}
      />
    );
  }

  return (
    <div
      className={cn("rounded-full flex items-center justify-center text-white font-semibold shrink-0 ring-2 ring-white/20 ring-offset-1 ring-offset-background", sizeClass, colorClass, className)}
      data-testid={`avatar-${userId}`}
    >
      {initials}
    </div>
  );
}
