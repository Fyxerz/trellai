"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { ChatMessage } from "@/types";

function buildToolMarker(toolCounts: Map<string, number>): string {
  const parts = Array.from(toolCounts.entries()).map(
    ([name, count]) => `${name}×${count}`
  );
  return `\n{{tools:${parts.join(",")}}}`;
}

export function useProjectChat(
  projectId: string | null,
  onCardCreated?: () => void
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const toolCountsRef = useRef<Map<string, number>>(new Map());

  const fetchMessages = useCallback(async () => {
    if (!projectId) return;
    const res = await fetch(`/api/project-chat?projectId=${projectId}`);
    const data = await res.json();
    setMessages(data);
  }, [projectId]);

  const fetchAgentStatus = useCallback(async () => {
    if (!projectId) return;
    const res = await fetch("/api/project-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", projectId }),
    });
    const data = await res.json();
    setAgentRunning(data.running);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    fetchMessages();
    fetchAgentStatus();

    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join:project", projectId);
    });

    socket.on("agent:output", (data) => {
      if (data.projectId !== projectId) return;

      if (data.type === "system") {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            cardId: null,
            projectId,
            role: "system",
            content: data.content,
            column: "project",
            createdAt: data.timestamp,
          },
        ]);
        return;
      }

      if (data.type === "result") {
        setStreaming(false);
        toolCountsRef.current = new Map();
        setMessages((prev) => {
          const streamingId = `streaming-project-${projectId}`;
          const filtered = prev.filter((m) => m.id !== streamingId);
          if (!data.content) return filtered;
          return [
            ...filtered,
            {
              id: crypto.randomUUID(),
              cardId: null,
              projectId,
              role: "assistant" as const,
              content: data.content,
              column: "project",
              createdAt: data.timestamp,
            },
          ];
        });
        return;
      }

      if (data.type === "tool_use") {
        setStreaming(true);
        const streamingId = `streaming-project-${projectId}`;
        const toolName = data.content.replace("Using tool: ", "").trim();
        toolCountsRef.current.set(
          toolName,
          (toolCountsRef.current.get(toolName) || 0) + 1
        );
        const marker = buildToolMarker(toolCountsRef.current);
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === streamingId);
          if (existing) {
            const content = existing.content.replace(/\n?{{tools:[^}]+}}/g, "") + marker;
            return prev.map((m) =>
              m.id === streamingId ? { ...m, content } : m
            );
          }
          return [
            ...prev,
            {
              id: streamingId,
              cardId: null,
              projectId,
              role: "assistant" as const,
              content: marker,
              column: "project",
              createdAt: data.timestamp,
            },
          ];
        });
      }

      if (data.type === "text") {
        if (toolCountsRef.current.size > 0) {
          toolCountsRef.current = new Map();
        }
        setStreaming(true);
        const streamingId = `streaming-project-${projectId}`;
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === streamingId);
          if (existing) {
            return prev.map((m) =>
              m.id === streamingId
                ? { ...m, content: m.content + data.content }
                : m
            );
          }
          return [
            ...prev,
            {
              id: streamingId,
              cardId: null,
              projectId,
              role: "assistant" as const,
              content: data.content,
              column: "project",
              createdAt: data.timestamp,
            },
          ];
        });
      }
    });

    socket.on("agent:status", (data) => {
      if (data.projectId === projectId) {
        const running = data.status === "running";
        setAgentRunning(running);
        if (!running) setStreaming(false);
      }
    });

    socket.on("agent:error", (data) => {
      if (data.projectId === projectId) {
        setStreaming(false);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            cardId: null,
            projectId,
            role: "system",
            content: `Error: ${data.error}`,
            column: "project",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    });

    socket.on("project:card-created", (data) => {
      if (data.projectId === projectId) {
        onCardCreated?.();
      }
    });

    return () => {
      socket.emit("leave:project", projectId);
      socket.disconnect();
    };
  }, [projectId, fetchMessages]);

  const sendMessage = async (content: string) => {
    if (!projectId) return;

    // Optimistic update
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        cardId: null,
        projectId,
        role: "user",
        content,
        column: "project",
        createdAt: new Date().toISOString(),
      },
    ]);

    setStreaming(true);
    try {
      const res = await fetch("/api/project-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_message",
          projectId,
          message: content,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setStreaming(false);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            cardId: null,
            projectId,
            role: "system",
            content: `Error: ${data.error}`,
            column: "project",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setStreaming(false);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          cardId: null,
          projectId,
          role: "system",
          content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          column: "project",
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  };

  const clearChat = async () => {
    if (!projectId) return;
    await fetch("/api/project-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear", projectId }),
    });
    setMessages([]);
    setStreaming(false);
    setAgentRunning(false);
  };

  return { messages, agentRunning, streaming, sendMessage, clearChat };
}
