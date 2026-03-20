"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { ChatMessage, ChatSegment, Column } from "@/types";

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
  const segmentsRef = useRef<ChatSegment[]>([]);

  const fetchMessages = useCallback(async () => {
    if (!cardId) return;
    const res = await fetch(`/api/agents?cardId=${cardId}`);
    const data = await res.json();
    // Attach segments from messageType for historical messages
    const enriched = data.map((msg: ChatMessage & { messageType?: string }) => ({
      ...msg,
      segments: undefined, // Will be parsed on render from messageType
    }));
    setMessages(enriched);
  }, [cardId]);

  const fetchPendingQuestion = useCallback(async (retries = 0) => {
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
      } else if (retries < 3) {
        // Retry after a short delay — question may not be queued in memory yet
        setTimeout(() => fetchPendingQuestion(retries + 1), 500);
      }
    } catch {
      // Ignore errors — question may not exist
    }
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
    // If awaiting feedback, fetch the pending question (don't set streaming — question card replaces dots)
    if (data.awaitingFeedback) {
      fetchPendingQuestion();
    }
  }, [cardId, fetchPendingQuestion]);

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
      const streamingId = `streaming-${cardId}`;

      // Restore segments from the orchestrator's buffer
      const restoredSegments: ChatSegment[] = (data.segments || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (seg: any) => {
          if (seg.kind === "thinking") return { kind: "thinking", content: seg.content } as ChatSegment;
          if (seg.kind === "tool_use") return { kind: "tool_use", toolName: seg.toolName || "", input: seg.input || "" } as ChatSegment;
          if (seg.kind === "tool_result") return { kind: "tool_result", toolName: seg.toolName || "", content: seg.content } as ChatSegment;
          return { kind: "text", content: seg.content } as ChatSegment;
        }
      );
      segmentsRef.current = restoredSegments;

      if (restoredSegments.length === 0 && !data.text) return;

      setStreaming(true);
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== streamingId);
        return [
          ...filtered,
          {
            id: streamingId,
            cardId,
            role: "assistant" as const,
            content: data.text || "",
            column: data.column || "production",
            segments: restoredSegments,
            createdAt: new Date().toISOString(),
          },
        ];
      });
    } catch {
      // Ignore errors — streaming state may not exist
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
        segmentsRef.current = [];
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

      // All streaming types — update the streaming placeholder with segments
      setStreaming(true);
      const streamingId = `streaming-${cardId}`;
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
        // Update the last tool_use segment with input details
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
      } else if (data.type === "tool_progress") {
        // Don't add a segment — just keep streaming indicator alive
      }

      // Build content as plain text fallback from all text segments
      const plainText = segments
        .filter(s => s.kind === "text")
        .map(s => s.content)
        .join("");

      // Clone segments to trigger re-render
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
            cardId,
            role: "assistant" as const,
            content: plainText,
            column: col,
            segments: segmentsCopy,
            createdAt: data.timestamp,
          },
        ];
      });
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
        // If awaiting_feedback, stop the streaming dots and fetch the pending question
        // The question card will replace the dots once pendingQuestion is set
        if (awaitingFeedback) {
          setStreaming(false);
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

    if (column === "features" || column === "planning" || column === "production") {
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
