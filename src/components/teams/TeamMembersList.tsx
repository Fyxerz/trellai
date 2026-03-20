"use client";
import { useState } from "react";
import { UserMinus, Shield, ShieldCheck, Crown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TeamMember, TeamMemberRole } from "@/types";

interface TeamMembersListProps {
  members: TeamMember[];
  canManageMembers: boolean;
  isOwner: boolean;
  currentUserId: string | undefined;
  onUpdateRole: (memberId: string, role: TeamMemberRole) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
}

const roleIcons: Record<TeamMemberRole, React.ReactNode> = {
  owner: <Crown className="h-3.5 w-3.5 text-amber-400" />,
  admin: <ShieldCheck className="h-3.5 w-3.5 text-violet-400" />,
  member: <Shield className="h-3.5 w-3.5 text-white/30" />,
};

const roleLabels: Record<TeamMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const roleColors: Record<TeamMemberRole, string> = {
  owner: "text-amber-400",
  admin: "text-violet-400",
  member: "text-white/50",
};

export function TeamMembersList({
  members,
  canManageMembers,
  isOwner,
  currentUserId,
  onUpdateRole,
  onRemoveMember,
}: TeamMembersListProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleRoleChange = async (memberId: string, role: TeamMemberRole) => {
    setActionLoading(memberId);
    try {
      await onUpdateRole(memberId, role);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm("Remove this member from the team?")) return;
    setActionLoading(memberId);
    try {
      await onRemoveMember(memberId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setActionLoading(null);
    }
  };

  // Sort: owners first, then admins, then members
  const sortedMembers = [...members].sort((a, b) => {
    const order: Record<string, number> = { owner: 0, admin: 1, member: 2 };
    return (order[a.role] ?? 3) - (order[b.role] ?? 3);
  });

  return (
    <div className="space-y-2">
      {sortedMembers.map((member) => {
        const isCurrentUser = member.userId === currentUserId;
        const isMemberOwner = member.role === "owner";

        return (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 border border-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-400/30 to-indigo-500/30 text-xs font-bold text-white/70">
                {member.userId.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white/90">
                  {member.userId}
                  {isCurrentUser && (
                    <span className="ml-2 text-xs text-white/30">(you)</span>
                  )}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {roleIcons[member.role]}
                  <span className={`text-xs font-medium ${roleColors[member.role]}`}>
                    {roleLabels[member.role]}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions — only owners can change roles, owner/admin can remove */}
            {canManageMembers && !isCurrentUser && !isMemberOwner && (
              <div className="flex items-center gap-2">
                {isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="rounded-lg px-2.5 py-1.5 text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors disabled:opacity-40"
                      disabled={actionLoading === member.id}
                    >
                      Change Role
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass border-white/10">
                      <DropdownMenuItem
                        className="text-white/70 focus:text-white focus:bg-white/10"
                        onClick={() => handleRoleChange(member.id, "admin")}
                        disabled={member.role === "admin"}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 mr-2 text-violet-400" />
                        Admin
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-white/70 focus:text-white focus:bg-white/10"
                        onClick={() => handleRoleChange(member.id, "member")}
                        disabled={member.role === "member"}
                      >
                        <Shield className="h-3.5 w-3.5 mr-2" />
                        Member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <button
                  className="rounded-lg p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                  onClick={() => handleRemove(member.id)}
                  disabled={actionLoading === member.id}
                  title="Remove member"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
