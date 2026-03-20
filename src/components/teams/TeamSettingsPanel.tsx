"use client";
import { useState } from "react";
import { Settings, Users, Mail, Trash2, UserPlus } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useTeamInvites } from "@/hooks/useInvites";
import { useTeamRole } from "@/hooks/useTeamRole";
import { useAuth } from "@/hooks/useAuth";
import { TeamMembersList } from "./TeamMembersList";
import { PendingInvitesList } from "./PendingInvitesList";
import { InviteMemberDialog } from "./InviteMemberDialog";
import type { Team } from "@/types";

interface TeamSettingsPanelProps {
  team: Team;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function TeamSettingsPanel({
  team,
  onRename,
  onDelete,
}: TeamSettingsPanelProps) {
  const { user } = useAuth();
  const { members, loading: membersLoading, updateRole, removeMember } = useTeamMembers(team.id);
  const { invites, loading: invitesLoading, sendInvite, revokeInvite } = useTeamInvites(team.id);
  const { isOwner, canManageMembers, canDeleteTeam, canInvite } = useTeamRole(members);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Rename state
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(team.name);
  const [renaming, setRenaming] = useState(false);

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleRename = async () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === team.name) {
      setDraftName(team.name);
      setEditing(false);
      return;
    }
    setRenaming(true);
    try {
      await onRename(trimmed);
      setEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename team");
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await onDelete();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete team");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* General Settings */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-4 w-4 text-white/50" />
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
            General
          </h3>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-4 border border-white/5">
          <div>
            <label className="text-sm font-medium text-white/70">
              Team Name
            </label>
            {editing ? (
              <div className="mt-1.5 flex gap-2">
                <input
                  className="flex-1 rounded-xl bg-white/8 px-4 py-2.5 text-sm text-white placeholder:text-white/30 border border-white/10 focus:border-white/25 focus:outline-none transition-colors"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") {
                      setDraftName(team.name);
                      setEditing(false);
                    }
                  }}
                  disabled={renaming}
                  autoFocus
                />
                <button
                  className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-600 transition-colors disabled:opacity-40"
                  onClick={handleRename}
                  disabled={renaming}
                >
                  {renaming ? "..." : "Save"}
                </button>
              </div>
            ) : (
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-sm text-white/90">{team.name}</p>
                {canManageMembers && !team.isPersonal && (
                  <button
                    className="text-xs text-white/40 hover:text-white/70 transition-colors"
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>

          {team.isPersonal && (
            <p className="text-xs text-white/30">
              This is your personal team. It cannot be renamed or deleted.
            </p>
          )}
        </div>
      </section>

      {/* Members */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-white/50" />
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
              Members
            </h3>
            <span className="text-xs text-white/30">
              ({members.length})
            </span>
          </div>
          {canInvite && (
            <button
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-violet-400 hover:bg-violet-400/10 transition-colors"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Invite
            </button>
          )}
        </div>

        {membersLoading ? (
          <p className="text-sm text-white/30 py-4">Loading members...</p>
        ) : (
          <TeamMembersList
            members={members}
            canManageMembers={canManageMembers}
            isOwner={isOwner}
            currentUserId={user?.id}
            onUpdateRole={updateRole}
            onRemoveMember={removeMember}
          />
        )}
      </section>

      {/* Pending Invites */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-4 w-4 text-white/50" />
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
            Pending Invitations
          </h3>
        </div>

        {invitesLoading ? (
          <p className="text-sm text-white/30 py-4">Loading invites...</p>
        ) : (
          <PendingInvitesList
            invites={invites}
            canManageMembers={canManageMembers}
            onRevoke={revokeInvite}
          />
        )}
      </section>

      {/* Danger Zone */}
      {canDeleteTeam && !team.isPersonal && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Trash2 className="h-4 w-4 text-red-400/70" />
            <h3 className="text-sm font-semibold text-red-400/70 uppercase tracking-wider">
              Danger Zone
            </h3>
          </div>

          <div className="glass-card rounded-xl p-5 border border-red-400/10">
            <p className="text-sm text-white/50 mb-3">
              Deleting this team will remove all members and invitations.
              Projects will become unassigned.
            </p>
            <button
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                confirmDelete
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-red-400/10 text-red-400 hover:bg-red-400/20"
              } disabled:opacity-40`}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? "Deleting..."
                : confirmDelete
                ? "Click again to confirm"
                : "Delete Team"}
            </button>
          </div>
        </section>
      )}

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={sendInvite}
      />
    </div>
  );
}
