"use client";

import { getInitials } from "@/lib/identity";
import type { PresenceUser, UserIdentity } from "@/types";

interface PresenceBarProps {
  users: PresenceUser[];
  currentUser: UserIdentity;
}

export function PresenceBar({ users, currentUser }: PresenceBarProps) {
  // Show current user first, then others
  const others = users.filter((u) => u.id !== currentUser.id);
  const totalOnline = others.length + 1; // +1 for current user

  return (
    <div className="flex items-center gap-2">
      {/* Current user avatar */}
      <div
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-white/20 shrink-0"
        style={{ backgroundColor: currentUser.color }}
        title={`${currentUser.name} (you)`}
      >
        {getInitials(currentUser.name)}
        {/* Online dot */}
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0f0f14]" />
      </div>

      {/* Other users */}
      <div className="flex -space-x-2">
        {others.slice(0, 5).map((user) => (
          <div
            key={user.id}
            className="relative flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-[#0f0f14] transition-transform hover:z-10 hover:scale-110 shrink-0"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {getInitials(user.name)}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0f0f14]" />
          </div>
        ))}
        {others.length > 5 && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white/60 ring-2 ring-[#0f0f14] shrink-0"
            title={`${others.length - 5} more users`}
          >
            +{others.length - 5}
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
