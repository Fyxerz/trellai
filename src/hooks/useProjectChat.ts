"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getSocketUrl } from "@/lib/socket-url";
import type { ChatMessage, ChatSegment } from "@/types";

export function useProjectChat(
  projectId: string | null,
  onCardCreated?: () => void
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const segmentsRef = useRef<ChatSegment[]>([]);

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

    const socket = io(getSocketUrl());
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
        segmentsRef.current = [];
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

      // All streaming types — update the streaming placeholder with segments
      setStreaming(true);
      const streamingId = `streaming-project-${projectId}`;
      const segments = segmentsRef.current;

      if (data.type === "thinking") {
        const lastSeg = segments[segments.length - 1];
        if (lastSeg && lastSeg.kind === "thinking") {
          lastSeg.content += data.content;
        } else {
          segments.push({ kind: "thinking", content: data.content });
        }
      } else if (data.type === "tool_use") {
        const toolName = (data.toolName || data.content.replace("Using tool: ", "")).trim();
        segments.push({ kind: "tool_use", toolName, input: "" });
      } else if (data.type === "tool_input") {
        const lastToolSeg = [...segments].reverse().find(s => s.kind === "tool_use") as { kind: "tool_use"; toolName: string; input: string } | undefined;
        if (lastToolSeg) {
          lastToolSeg.input = data.content;
        }
      } else if (data.type === "tool_result") {
        const toolName = data.toolName || "unknown";
        segments.push({ kind: "tool_result", toolName, content: data.content });
      } else if (data.type === "tool_summary") {
        segments.push({ kind: "text", content: data.content });
      } else if (data.type === "text") {
        const lastSeg = segments[segments.length - 1];
        if (lastSeg && lastSeg.kind === "text") {
          lastSeg.content += data.content;
        } else {
          segments.push({ kind: "text", content: data.content });
        }
      }

      const plainText = segments
        .filter(s => s.kind === "text")
        .map(s => s.content)
        .join("");

      const segmentsCopy = segments.map(s => ({ ...s })) as ChatSegment[];

      setMessages((prev) => {
        const existing = prev.find((m) => m.id === streamingId);
        if (existing) {
          return prev.map((m) =>
            m.id === streamingId
              ? { ...m, content: plainText, segments: segmentsCopy }
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
            content: plainText,
            column: "project",
            segments: segmentsCopy,
            createdAt: data.timestamp,
          },
        ];
      });
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
