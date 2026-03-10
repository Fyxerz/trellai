"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { ChatMessage, Column } from "@/types";

export function useChat(cardId: string | null, onAutoMove?: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!cardId) return;
    const res = await fetch(`/api/agents?cardId=${cardId}`);
    const data = await res.json();
    setMessages(data);
  }, [cardId]);

  const fetchAgentStatus = useCallback(async () => {
    if (!cardId) return;
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", cardId }),
    });
    const data = await res.json();
    setAgentRunning(data.running);
  }, [cardId]);

  useEffect(() => {
    if (!cardId) return;
    fetchMessages();
    fetchAgentStatus();

    // Connect to socket.io sidecar
    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join:card", cardId);
    });

    socket.on("agent:output", (data) => {
      if (data.cardId !== cardId) return;
      const col = data.column || "production";

      if (data.type === "system") {
        // System messages: always append as standalone
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            cardId,
            role: "system",
            content: data.content,
            column: col,
            createdAt: data.timestamp,
          },
        ]);
        return;
      }

      if (data.type === "result") {
        // Final complete message — replace any streaming placeholder
        setStreaming(false);
        setMessages((prev) => {
          const streamingId = `streaming-${cardId}`;
          const filtered = prev.filter((m) => m.id !== streamingId);
          if (!data.content) return filtered;
          return [
            ...filtered,
            {
              id: crypto.randomUUID(),
              cardId,
              role: "assistant" as const,
              content: data.content,
              column: col,
              createdAt: data.timestamp,
            },
          ];
        });
        return;
      }

      if (data.type === "text" || data.type === "tool_use") {
        // Streaming delta — accumulate into a single in-progress message
        setStreaming(true);
        const streamingId = `streaming-${cardId}`;
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
              cardId,
              role: "assistant" as const,
              content: data.content,
              column: col,
              createdAt: data.timestamp,
            },
          ];
        });
      }
    });

    socket.on("agent:status", (data) => {
      if (data.cardId === cardId) {
        const running = data.status === "running";
        setAgentRunning(running);
        if (!running) setStreaming(false);
      }
    });

    socket.on("agent:error", (data) => {
      if (data.cardId === cardId) {
        setStreaming(false);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            cardId,
            role: "system",
            content: `Error: ${data.error}`,
            column: data.column || "production",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    });

    socket.on("card:auto-move", (data) => {
      if (data.cardId === cardId) {
        onAutoMove?.();
      }
    });

    return () => {
      socket.emit("leave:card", cardId);
      socket.disconnect();
    };
  }, [cardId, fetchMessages]);

  const sendMessage = async (content: string, column: Column) => {
    if (!cardId) return;

    // Optimistic update
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        cardId,
        role: "user",
        content,
        column,
        createdAt: new Date().toISOString(),
      },
    ]);

    if (column === "features" || column === "production") {
      // Unified path: all agent interactions go through send_message
      setStreaming(true);
      try {
        const res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send_message",
            cardId,
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
              cardId,
              role: "system",
              content: `Error: ${data.error}`,
              column,
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
            cardId,
            role: "system",
            content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
            column,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } else {
      // Review/complete: just save the message
      await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_message",
          cardId,
          message: content,
          column,
        }),
      });
    }
  };

  const confirmMoveToDev = async () => {
    if (!cardId) return;
    try {
      await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_move_to_dev", cardId }),
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          cardId,
          role: "system",
          content: `Error moving to development: ${err instanceof Error ? err.message : "Unknown error"}`,
          column: "features",
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  };

  return { messages, agentRunning, streaming, sendMessage, confirmMoveToDev, refreshMessages: fetchMessages };
}
