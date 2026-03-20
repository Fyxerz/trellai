"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { TeamMemberRole } from "@/types";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (email: string, role: TeamMemberRole) => Promise<void>;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  onInvite,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamMemberRole>("member");
  const [sending, setSending] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setSending(true);
    try {
      await onInvite(email.trim(), role);
      setEmail("");
      setRole("member");
      onOpenChange(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={sending ? () => {} : onOpenChange}>
      <DialogContent className="glass border-white/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Invite Member</DialogTitle>
          <DialogDescription className="text-white/50">
            Send an invitation to join this team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium text-white/70">
              Email Address
            </label>
            <input
              type="email"
              className="mt-1.5 w-full rounded-xl bg-white/8 px-4 py-2.5 text-sm text-white placeholder:text-white/30 border border-white/10 focus:border-white/25 focus:outline-none transition-colors"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white/70">Role</label>
            <select
              className="mt-1.5 w-full rounded-xl bg-white/8 px-4 py-2.5 text-sm text-white border border-white/10 focus:border-white/25 focus:outline-none transition-colors"
              value={role}
              onChange={(e) => setRole(e.target.value as TeamMemberRole)}
            >
              <option value="member" className="bg-zinc-900">Member</option>
              <option value="admin" className="bg-zinc-900">Admin</option>
            </select>
          </div>
          <button
            className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow disabled:opacity-40 disabled:shadow-none"
            disabled={!email.trim() || sending}
            onClick={handleInvite}
          >
            {sending ? "Sending..." : "Send Invite"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
