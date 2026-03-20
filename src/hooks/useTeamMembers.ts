"use client";
import { useState, useEffect, useCallback } from "react";
import type { TeamMember, TeamMemberRole } from "@/types";

export function useTeamMembers(teamId: string | null) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!teamId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/teams/${teamId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error("Failed to fetch team members:", err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const updateRole = useCallback(
    async (memberId: string, role: TeamMemberRole) => {
      if (!teamId) return;
      const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }
      await fetchMembers();
    },
    [teamId, fetchMembers]
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      if (!teamId) return;
      const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }
      await fetchMembers();
    },
    [teamId, fetchMembers]
  );

  return {
    members,
    loading,
    updateRole,
    removeMember,
    refresh: fetchMembers,
  };
}
