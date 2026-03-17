"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { ChatMessage, Column } from "@/types";

function buildToolMarker(toolCounts: Map<string, number>): string {
  const parts = Array.from(toolCounts.entries()).map(
    ([name, count]) => `${name}×${count}`
  );
  return `\n{{tools:${parts.join(",")}}}`;
}

export interface PendingQuestion {
  questionId: string;
  question: string;
  options: string[];
}

export function useChat(cardId: string | null, onAutoMove?: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const toolCountsRef = useRef<Map<string, number>>(new Map());

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
    // If agent is running, show streaming indicator so user knows it's active
    if (data.running) {
      setStreaming(true);
    }
  }, [cardId]);

  const fetchStreamingState = useCallback(async () => {
    if (!cardId) return;
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "streaming_state", cardId }),
      });
      const data = await res.json();
      if (!data) return;
      // Reconstruct the streaming message from the orchestrator's buffer
      const streamingId = `streaming-${cardId}`;
      // Restore tool counts
      const restoredToolCounts = new Map<string, number>(
        Object.entries(data.toolCounts || {}).map(([k, v]) => [k, v as number])
      );
      toolCountsRef.current = restoredToolCounts;
      // Build content: buffered text + current tool marker (if any tools in progress)
      let content = data.text || "";
      if (restoredToolCounts.size > 0) {
        content += buildToolMarker(restoredToolCounts);
      }
      if (!content) return;
      setStreaming(true);
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== streamingId);
        return [
          ...filtered,
          {
            id: streamingId,
            cardId,
            role: "assistant" as const,
            content,
            column: data.column || "production",
            createdAt: new Date().toISOString(),
          },
        ];
      });
    } catch {
      // Ignore errors — streaming state may not exist
    }
  }, [cardId]);

  const fetchPendingQuestion = useCallback(async () => {
    if (!cardId) return;
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pending_question", cardId }),
      });
      const data = await res.json();
      if (data.pendingQuestion) {
        setPendingQuestion(data.pendingQuestion);
      }
    } catch {
      // Ignore errors — question may not exist
    }
  }, [cardId]);

  useEffect(() => {
    if (!cardId) return;
    fetchMessages();
    fetchAgentStatus();
    fetchPendingQuestion();
    fetchStreamingState();

    // Connect to socket.io sidecar
    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join:card", cardId);
      // Re-fetch state on reconnect to catch messages received while disconnected
      fetchMessages();
      fetchPendingQuestion();
      fetchStreamingState();
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
        toolCountsRef.current = new Map();
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

      if (data.type === "tool_use") {
        // Compact tool uses into a single inline marker
        setStreaming(true);
        const streamingId = `streaming-${cardId}`;
        const toolName = data.content.replace("Using tool: ", "").trim();
        toolCountsRef.current.set(
          toolName,
          (toolCountsRef.current.get(toolName) || 0) + 1
        );
        const marker = buildToolMarker(toolCountsRef.current);
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === streamingId);
          if (existing) {
            // Replace any existing trailing marker, or append one
            const content = existing.content.replace(/\n?{{tools:[^}]+}}/g, "") + marker;
            return prev.map((m) =>
              m.id === streamingId ? { ...m, content } : m
            );
          }
          return [
            ...prev,
            {
              id: streamingId,
              cardId,
              role: "assistant" as const,
              content: marker,
              column: col,
              createdAt: data.timestamp,
            },
          ];
        });
      }

      if (data.type === "text") {
        // Text delta — reset tool counts (group boundary) and append text
        if (toolCountsRef.current.size > 0) {
          toolCountsRef.current = new Map();
        }
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
        const awaitingFeedback = data.status === "awaiting_feedback";
        setAgentRunning(running);
        if (!running && !awaitingFeedback) {
          setStreaming(false);
          // Re-fetch messages from DB to catch any that arrived while popup was closed
          fetchMessages();
        }
        // If awaiting_feedback, fetch the pending question in case we missed the socket event
        if (awaitingFeedback) {
          fetchPendingQuestion();
        }
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

    socket.on("agent:question", (data) => {
      if (data.cardId !== cardId) return;
      setPendingQuestion({
        questionId: data.questionId,
        question: data.question,
        options: data.options,
      });
    });

    return () => {
      socket.emit("leave:card", cardId);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

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

  const stopAgent = useCallback(async () => {
    if (!cardId) return;
    await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop", cardId }),
    });
  }, [cardId]);

  const answerQuestion = useCallback(async (questionId: string, answer: string, questionText: string) => {
    if (!cardId) return;

    // Optimistic update: show combined Q&A block in messages and clear the question
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        cardId,
        role: "assistant",
        content: `{{qa:${questionText}||${answer}}}`,
        column: "features" as Column,
        createdAt: new Date().toISOString(),
      },
    ]);
    setPendingQuestion(null);

    try {
      await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer_question",
          cardId,
          questionId,
          answer,
          question: questionText,
        }),
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          cardId,
          role: "system",
          content: `Error answering question: ${err instanceof Error ? err.message : "Unknown error"}`,
          column: "features" as Column,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  }, [cardId]);

  return { messages, agentRunning, streaming, pendingQuestion, sendMessage, confirmMoveToDev, stopAgent, answerQuestion, refreshMessages: fetchMessages };
}
