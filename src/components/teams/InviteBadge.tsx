"use client";
import Link from "next/link";
import { Mail } from "lucide-react";
import { useMyInvites } from "@/hooks/useInvites";
import { useMyBoardInvites } from "@/hooks/useBoardInvites";

/**
 * Notification badge showing pending invite count (team + board invites).
 * Shows in the header; links to /invites page.
 */
export function InviteBadge() {
  const { invites: teamInvites, loading: teamLoading } = useMyInvites();
  const { invites: boardInvites, loading: boardLoading } = useMyBoardInvites();

  const totalCount = teamInvites.length + boardInvites.length;

  if ((teamLoading && boardLoading) || totalCount === 0) return null;

  return (
    <Link
      href="/invites"
      className="relative flex items-center justify-center rounded-xl bg-white/5 p-2 text-white/60 hover:text-white/80 hover:bg-white/8 transition-colors"
      title={`${totalCount} pending invite${totalCount !== 1 ? "s" : ""}`}
    >
      <Mail className="h-4 w-4" />
      <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white">
        {totalCount}
      </span>
    </Link>
  );
}
