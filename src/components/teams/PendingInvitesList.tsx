"use client";
import { useState } from "react";
import { Mail, X, Clock } from "lucide-react";
import type { Invite } from "@/types";

interface PendingInvitesListProps {
  invites: Invite[];
  canManageMembers: boolean;
  onRevoke: (inviteId: string) => Promise<void>;
}

export function PendingInvitesList({
  invites,
  canManageMembers,
  onRevoke,
}: PendingInvitesListProps) {
  const [revoking, setRevoking] = useState<string | null>(null);

  const pendingInvites = invites.filter((i) => i.status === "pending");

  if (pendingInvites.length === 0) {
    return (
      <p className="text-sm text-white/30 py-2">No pending invitations.</p>
    );
  }

  const handleRevoke = async (inviteId: string) => {
    setRevoking(inviteId);
    try {
      await onRevoke(inviteId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke invite");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="space-y-2">
      {pendingInvites.map((invite) => (
        <div
          key={invite.id}
          className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 border border-white/5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/10">
              <Mail className="h-4 w-4 text-amber-400/70" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/80">{invite.email}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Clock className="h-3 w-3 text-white/30" />
                <span className="text-xs text-white/40">
                  Invited as {invite.role}
                </span>
              </div>
            </div>
          </div>

          {canManageMembers && (
            <button
              className="rounded-lg p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
              onClick={() => handleRevoke(invite.id)}
              disabled={revoking === invite.id}
              title="Revoke invite"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
