"use client";
import { useState, useEffect, useCallback } from "react";
import type { BoardCollaborator, BoardRole } from "@/types";

export function useBoardCollaborators(projectId: string | null) {
  const [collaborators, setCollaborators] = useState<BoardCollaborator[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCollaborators = useCallback(async () => {
    if (!projectId) {
      setCollaborators([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/collaborators`);
      if (res.ok) {
        const data = await res.json();
        setCollaborators(data);
      }
    } catch (err) {
      console.error("Failed to fetch board collaborators:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  const addCollaborator = useCallback(
    async (userId: string, role: BoardRole) => {
      if (!projectId) return;
      const res = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add collaborator");
      }
      await fetchCollaborators();
    },
    [projectId, fetchCollaborators]
  );

  const updateRole = useCallback(
    async (collaboratorId: string, role: BoardRole) => {
      if (!projectId) return;
      const res = await fetch(`/api/projects/${projectId}/collaborators/${collaboratorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update collaborator role");
      }
      await fetchCollaborators();
    },
    [projectId, fetchCollaborators]
  );

  const removeCollaborator = useCallback(
    async (collaboratorId: string) => {
      if (!projectId) return;
      const res = await fetch(`/api/projects/${projectId}/collaborators/${collaboratorId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove collaborator");
      }
      await fetchCollaborators();
    },
    [projectId, fetchCollaborators]
  );

  return {
    collaborators,
    loading,
    addCollaborator,
    updateRole,
    removeCollaborator,
    refresh: fetchCollaborators,
  };
}
