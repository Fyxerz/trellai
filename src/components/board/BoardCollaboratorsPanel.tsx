"use client";
import { useState } from "react";
import { Users, Mail, X, Shield, ShieldCheck, Eye, Pencil, UserPlus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBoardCollaborators } from "@/hooks/useBoardCollaborators";
import { useBoardInvites } from "@/hooks/useBoardInvites";
import type { BoardRole } from "@/types";

interface BoardCollaboratorsPanelProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roleIcons: Record<BoardRole, React.ReactNode> = {
  viewer: <Eye className="h-3.5 w-3.5" />,
  editor: <Pencil className="h-3.5 w-3.5" />,
  admin: <ShieldCheck className="h-3.5 w-3.5" />,
};

const roleLabels: Record<BoardRole, string> = {
  viewer: "Viewer",
  editor: "Editor",
  admin: "Admin",
};

const roleDescriptions: Record<BoardRole, string> = {
  viewer: "Can view board, cards, chat, and diffs",
  editor: "Can edit cards, run agents, and chat",
  admin: "Full access including managing collaborators",
};

export function BoardCollaboratorsPanel({
  projectId,
  open,
  onOpenChange,
}: BoardCollaboratorsPanelProps) {
  const { collaborators, loading: collabLoading, updateRole, removeCollaborator } = useBoardCollaborators(projectId);
  const { invites, loading: inviteLoading, sendInvite } = useBoardInvites(projectId);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<BoardRole>("editor");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingInvites = invites.filter((inv) => inv.status === "pending");

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setError(null);
    setSending(true);
    try {
      await sendInvite(inviteEmail.trim(), inviteRole);
      setInviteEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Board Collaborators
          </DialogTitle>
          <DialogDescription>
            Invite people to collaborate on this board directly.
          </DialogDescription>
        </DialogHeader>

        {/* Invite form */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendInvite()}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-500/50 focus:outline-none"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as BoardRole)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={handleSendInvite}
              disabled={sending || !inviteEmail.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50 transition-colors"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase text-white/40">
              Pending Invites
            </h4>
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-white/30" />
                  <span className="text-sm text-white/70">{invite.email}</span>
                </div>
                <span className="text-xs text-white/40 capitalize">
                  {invite.role}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Current collaborators */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase text-white/40">
            Collaborators
          </h4>
          {(collabLoading || inviteLoading) ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-white/30" />
            </div>
          ) : collaborators.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/30">
              No collaborators yet. Invite someone above.
            </p>
          ) : (
            collaborators.map((collab) => (
              <div
                key={collab.id}
                className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-white/30" />
                  <span className="text-sm text-white/70">{collab.userId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/50 hover:bg-white/5 hover:text-white/70 transition-colors">
                      {roleIcons[collab.role]}
                      {roleLabels[collab.role]}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {(["viewer", "editor", "admin"] as BoardRole[]).map((role) => (
                        <DropdownMenuItem
                          key={role}
                          onClick={() => updateRole(collab.id, role)}
                          className="flex items-center gap-2"
                        >
                          {roleIcons[role]}
                          <div>
                            <div className="text-sm">{roleLabels[role]}</div>
                            <div className="text-xs text-white/40">{roleDescriptions[role]}</div>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    onClick={() => removeCollaborator(collab.id)}
                    className="rounded-md p-1 text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    title="Remove collaborator"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
