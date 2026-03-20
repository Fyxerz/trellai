"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { Card, Project, Team } from "@/types";

export interface ProjectSummary {
  project: Project;
  counts: {
    features: number;
    production: number;
    review: number;
    complete: number;
  };
  totalCards: number;
  attentionCards: Card[];
}

export function useDashboard() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  const fetchSummaries = useCallback(async () => {
    try {
      const res = await fetch("/api/projects/summary");
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Failed to fetch project summaries:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch {
      // Teams may not be available (e.g., no Supabase configured)
    }
  }, []);

  useEffect(() => {
    fetchSummaries();
    fetchTeams();
  }, [fetchSummaries, fetchTeams]);

  // Real-time updates via socket
  useEffect(() => {
    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.on("agent:status", () => {
      fetchSummaries();
    });

    socket.on("card:auto-move", () => {
      fetchSummaries();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [fetchSummaries]);

  const createProject = useCallback(
    async (name: string, repoPath: string, teamId?: string) => {
      const body: Record<string, string> = { name, repoPath };
      if (teamId) body.teamId = teamId;
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create project");
      }
      const project = await res.json();
      await fetchSummaries();
      return project;
    },
    [fetchSummaries]
  );

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

  const deleteProject = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete project");
      }
      await fetchSummaries();
    },
    [fetchSummaries]
  );

  const renameProject = useCallback(
    async (id: string, name: string) => {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to rename project");
      }
      await fetchSummaries();
    },
    [fetchSummaries]
  );

  // Flatten attention cards across all projects
  const attentionCards = useMemo(
    () =>
      projects.flatMap((p) =>
        p.attentionCards.map((c) => ({
          ...c,
          projectName: p.project.name,
          projectId: p.project.id,
        }))
      ),
    [projects]
  );

  // Group projects: personal (no teamId) vs team-assigned
  const personalProjects = useMemo(
    () => projects.filter((p) => !p.project.teamId),
    [projects]
  );

  const teamProjects = useMemo(() => {
    const map = new Map<string, ProjectSummary[]>();
    for (const p of projects) {
      if (p.project.teamId) {
        const existing = map.get(p.project.teamId) || [];
        existing.push(p);
        map.set(p.project.teamId, existing);
      }
    }
    return map;
  }, [projects]);

  const nonPersonalTeams = useMemo(
    () => teams.filter((t) => !t.isPersonal),
    [teams]
  );

  return {
    projects,
    teams,
    nonPersonalTeams,
    personalProjects,
    teamProjects,
    loading,
    attentionCards,
    createProject,
    createTeam,
    deleteProject,
    renameProject,
    refresh: fetchSummaries,
    refreshTeams: fetchTeams,
  };
}
