"use client";
import { useState, useEffect, useCallback } from "react";
import type { Team } from "@/types";

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const createTeam = useCallback(
    async (name: string) => {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create team");
      }
      const team = await res.json();
      await fetchTeams();
      return team as Team;
    },
    [fetchTeams]
  );

  const updateTeam = useCallback(
    async (id: string, name: string) => {
      const res = await fetch(`/api/teams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update team");
      }
      await fetchTeams();
    },
    [fetchTeams]
  );

  const deleteTeam = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/teams/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete team");
      }
      await fetchTeams();
    },
    [fetchTeams]
  );

  return {
    teams,
    loading,
    createTeam,
    updateTeam,
    deleteTeam,
    refresh: fetchTeams,
  };
}
