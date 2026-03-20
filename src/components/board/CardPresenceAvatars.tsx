"use client";

import { getInitials } from "@/lib/identity";
import type { PresenceUser } from "@/types";

interface CardPresenceAvatarsProps {
  viewers: PresenceUser[];
  maxShow?: number;
}

export function CardPresenceAvatars({ viewers, maxShow = 3 }: CardPresenceAvatarsProps) {
  if (viewers.length === 0) return null;

  return (
    <div className="flex -space-x-1.5 items-center">
      {viewers.slice(0, maxShow).map((user) =>
        user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={user.id}
            src={user.avatarUrl}
            alt={user.name}
            className="h-5 w-5 rounded-full ring-1 ring-white/20 object-cover transition-transform hover:z-10 hover:scale-125 shrink-0"
            title={`${user.name} is viewing`}
          />
        ) : (
          <div
            key={user.id}
            className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white ring-1 ring-white/20 transition-transform hover:z-10 hover:scale-125 shrink-0"
            style={{ backgroundColor: user.color }}
            title={`${user.name} is viewing`}
          >
            {getInitials(user.name)}
          </div>
        )
      )}
      {viewers.length > maxShow && (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[8px] font-bold text-white/60 ring-1 ring-white/20 shrink-0">
          +{viewers.length - maxShow}
        </div>
      )}
    </div>
  );
}
