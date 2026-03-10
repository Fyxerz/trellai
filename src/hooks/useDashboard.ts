"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { Card, Project } from "@/types";

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

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  // Real-time updates via socket
  useEffect(() => {
    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    // Listen for agent status changes and refresh summaries
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
    async (name: string, repoPath: string) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, repoPath }),
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

  return {
    projects,
    loading,
    attentionCards,
    createProject,
    deleteProject,
    renameProject,
    refresh: fetchSummaries,
  };
}
