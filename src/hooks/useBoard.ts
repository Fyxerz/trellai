"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getSocketUrl } from "@/lib/socket-url";
import type { Card, CardType, Project, Column, AgentStatus, TestResults, TestStatus } from "@/types";

export function useBoard(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        setError("Project not found");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setProject(data);
    } catch {
      setError("Failed to load project");
      setLoading(false);
    }
  }, [projectId]);

  const fetchCards = useCallback(async () => {
    if (!projectId) return;
    const res = await fetch(`/api/cards?projectId=${projectId}`);
    const data = await res.json();
    setCards(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    if (project) {
      fetchCards();
    }
  }, [project, fetchCards]);

  // Real-time status updates via socket
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!project) return;

    const socket = io(getSocketUrl());
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

    // Test results from development agent
    socket.on("card:test-results", (data: { cardId: string; testStatus: TestStatus; testResults: TestResults }) => {
      setCards((prev) =>
        prev.map((c) =>
          c.id === data.cardId
            ? { ...c, testStatus: data.testStatus, testResults: data.testResults, updatedAt: new Date().toISOString() }
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
  }, [project, cards.length]); // reconnect when cards are added/removed

  // Join new card rooms when cards change
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    for (const card of cards) {
      socket.emit("join:card", card.id);
    }
  }, [cards.length]);

  const renameProject = async (id: string, name: string) => {
    const res = await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    const updated = await res.json();
    setProject(updated);
    return updated;
  };

  const createCard = async (title: string, description = "", type: CardType = "feature", column?: Column) => {
    if (!project) return;
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        title,
        description,
        type,
        ...(column ? { column } : {}),
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
    if (!project) return;
    const res = await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: project.id, mode }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to switch mode");
      return;
    }
    const updated = await res.json();
    setProject(updated);
  };

  const refreshCards = () => fetchCards();

  const getColumnCards = (column: Column) => {
    // Priority tiers: lower number = sorted higher
    // Icebox cards always sink to the bottom (tier 3)
    const statusPriority = (card: Card): number => {
      if (card.isIcebox) return 3;
      if (card.agentStatus === "running") return 0;
      if (card.agentStatus === "awaiting_feedback" || card.agentStatus === "dev_complete" || card.agentStatus === "error") return 1;
      return 2;
    };
    return cards
      .filter((c) => c.column === column)
      .sort((a, b) => {
        const aPri = statusPriority(a);
        const bPri = statusPriority(b);
        if (aPri !== bPri) return aPri - bPri;
        return a.position - b.position;
      });
  };

  return {
    project,
    cards,
    loading,
    error,
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
