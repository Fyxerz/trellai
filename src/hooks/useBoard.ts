"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { Card, CardType, Project, Column, AgentStatus } from "@/types";

export function useBoard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data);
    if (data.length > 0 && !activeProject) {
      setActiveProject(data[0]);
    }
  }, [activeProject]);

  const fetchCards = useCallback(async () => {
    if (!activeProject) return;
    const res = await fetch(`/api/cards?projectId=${activeProject.id}`);
    const data = await res.json();
    setCards(data);
    setLoading(false);
  }, [activeProject]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (activeProject) {
      fetchCards();
    }
  }, [activeProject, fetchCards]);

  // Real-time status updates via socket
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!activeProject) return;

    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.on("connect", () => {
      // Join rooms for all current cards
      for (const card of cards) {
        socket.emit("join:card", card.id);
      }
    });

    // Status changes (running, awaiting_feedback, error, etc.)
    socket.on("agent:status", (data: { cardId: string; status: string }) => {
      setCards((prev) =>
        prev.map((c) =>
          c.id === data.cardId
            ? { ...c, agentStatus: data.status as AgentStatus, updatedAt: new Date().toISOString() }
            : c
        )
      );
    });

    // Auto-move events (card moved to a different column by orchestrator)
    socket.on("card:auto-move", (data: { cardId: string; column: string }) => {
      setCards((prev) =>
        prev.map((c) =>
          c.id === data.cardId
            ? { ...c, column: data.column as Column, updatedAt: new Date().toISOString() }
            : c
        )
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeProject, cards.length]); // reconnect when cards are added/removed

  // Join new card rooms when cards change
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    for (const card of cards) {
      socket.emit("join:card", card.id);
    }
  }, [cards.length]);

  const createProject = async (name: string, repoPath: string) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, repoPath }),
    });
    const project = await res.json();
    setProjects((prev) => [...prev, project]);
    setActiveProject(project);
    return project;
  };

  const renameProject = async (id: string, name: string) => {
    const res = await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    const updated = await res.json();
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    if (activeProject?.id === id) setActiveProject(updated);
    return updated;
  };

  const createCard = async (title: string, description = "", type: CardType = "feature") => {
    if (!activeProject) return;
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: activeProject.id,
        title,
        description,
        type,
      }),
    });
    const card = await res.json();
    setCards((prev) => [...prev, card]);
    return card;
  };

  const updateCard = async (id: string, updates: Partial<Card>) => {
    const res = await fetch(`/api/cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const updated = await res.json();
    setCards((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  };

  const moveCard = async (id: string, column: Column, position: number) => {
    // Optimistic update
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, column, position } : c))
    );

    const res = await fetch(`/api/cards/${id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column, position }),
    });

    if (!res.ok) {
      await fetchCards(); // revert optimistic update
      return;
    }

    const updated = await res.json();
    setCards((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  };

  const deleteCard = async (id: string) => {
    await fetch(`/api/cards/${id}`, { method: "DELETE" });
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  const toggleMode = async (mode: "worktree" | "queue") => {
    if (!activeProject) return;
    const res = await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeProject.id, mode }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to switch mode");
      return;
    }
    const updated = await res.json();
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setActiveProject(updated);
  };

  const refreshCards = () => fetchCards();

  const getColumnCards = (column: Column) => {
    // Statuses that need attention float to top
    const attentionStatuses = new Set(["awaiting_feedback", "dev_complete", "error"]);
    return cards
      .filter((c) => c.column === column)
      .sort((a, b) => {
        const aNeeds = attentionStatuses.has(a.agentStatus) ? 0 : 1;
        const bNeeds = attentionStatuses.has(b.agentStatus) ? 0 : 1;
        if (aNeeds !== bNeeds) return aNeeds - bNeeds;
        return a.position - b.position;
      });
  };

  return {
    projects,
    activeProject,
    setActiveProject,
    cards,
    loading,
    createProject,
    renameProject,
    createCard,
    updateCard,
    moveCard,
    deleteCard,
    refreshCards,
    getColumnCards,
    toggleMode,
  };
}
