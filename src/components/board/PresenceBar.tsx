"use client";

import { getInitials } from "@/lib/identity";
import type { PresenceUser } from "@/types";

interface PresenceBarProps {
  /** Other online users (current user is shown in the UserMenu avatar) */
  otherUsers: PresenceUser[];
  /** Total number of online users (including current user) */
  totalOnline: number;
}

function PresenceAvatar({ user }: { user: PresenceUser }) {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={user.name}
        className="h-8 w-8 rounded-full ring-2 ring-[#0f0f14] object-cover transition-transform hover:z-10 hover:scale-110 shrink-0"
        title={user.name}
      />
    );
  }

  return (
    <div
      className="relative flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-[#0f0f14] transition-transform hover:z-10 hover:scale-110 shrink-0"
      style={{ backgroundColor: user.color }}
      title={user.name}
    >
      {getInitials(user.name)}
      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0f0f14]" />
    </div>
  );
}

export function PresenceBar({ otherUsers, totalOnline }: PresenceBarProps) {
  // If nobody else is online, just show the count
  if (otherUsers.length === 0) {
    return (
      <span className="text-xs text-white/40">
        {totalOnline} online
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Other users */}
      <div className="flex -space-x-2">
        {otherUsers.slice(0, 5).map((user) => (
          <PresenceAvatar key={user.id} user={user} />
        ))}
        {otherUsers.length > 5 && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white/60 ring-2 ring-[#0f0f14] shrink-0"
            title={`${otherUsers.length - 5} more users`}
          >
            +{otherUsers.length - 5}
          </div>
        )}
      </div>

      {/* Online count label */}
      <span className="text-xs text-white/40 ml-1">
        {totalOnline} online
      </span>
    </div>
  );
}
