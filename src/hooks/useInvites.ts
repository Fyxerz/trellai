"use client";
import { useState, useEffect, useCallback } from "react";
import type { Invite, TeamMemberRole } from "@/types";

/** Manage invites for a specific team (sent invites). */
export function useTeamInvites(teamId: string | null) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvites = useCallback(async () => {
    if (!teamId) {
      setInvites([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/teams/${teamId}/invites`);
      if (res.ok) {
        const data = await res.json();
        setInvites(data);
      }
    } catch (err) {
      console.error("Failed to fetch team invites:", err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const sendInvite = useCallback(
    async (email: string, role: TeamMemberRole = "member") => {
      if (!teamId) return;
      const res = await fetch(`/api/teams/${teamId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invite");
      }
      await fetchInvites();
    },
    [teamId, fetchInvites]
  );

  const revokeInvite = useCallback(
    async (inviteId: string) => {
      if (!teamId) return;
      const res = await fetch(`/api/teams/${teamId}/invites/${inviteId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to revoke invite");
      }
      await fetchInvites();
    },
    [teamId, fetchInvites]
  );

  return {
    invites,
    loading,
    sendInvite,
    revokeInvite,
    refresh: fetchInvites,
  };
}

/** Manage the current user's pending invites (received invites). */
export function useMyInvites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/invites");
      if (res.ok) {
        const data = await res.json();
        setInvites(data);
      }
    } catch (err) {
      console.error("Failed to fetch invites:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const respondToInvite = useCallback(
    async (inviteId: string, action: "accept" | "decline") => {
      const res = await fetch(`/api/invites/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to respond to invite");
      }
      await fetchInvites();
    },
    [fetchInvites]
  );

  return {
    invites,
    loading,
    respondToInvite,
    refresh: fetchInvites,
  };
}
