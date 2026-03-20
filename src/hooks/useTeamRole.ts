"use client";
import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { TeamMember, TeamMemberRole } from "@/types";

interface TeamRoleInfo {
  role: TeamMemberRole | null;
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  canManageMembers: boolean;
  canDeleteTeam: boolean;
  canInvite: boolean;
}

/**
 * Given a list of team members, determines the current user's role
 * and permission booleans for the team.
 */
export function useTeamRole(members: TeamMember[]): TeamRoleInfo {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user) {
      return {
        role: null,
        isOwner: false,
        isAdmin: false,
        isMember: false,
        canManageMembers: false,
        canDeleteTeam: false,
        canInvite: false,
      };
    }

    const membership = members.find((m) => m.userId === user.id);
    const role = membership?.role ?? null;

    return {
      role,
      isOwner: role === "owner",
      isAdmin: role === "admin",
      isMember: role === "member",
      canManageMembers: role === "owner" || role === "admin",
      canDeleteTeam: role === "owner",
      canInvite: role === "owner" || role === "admin",
    };
  }, [user, members]);
}
