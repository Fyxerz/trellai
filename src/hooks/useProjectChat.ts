"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getSocketUrl } from "@/lib/socket-url";
import type { ChatMessage, ChatSegment, ChatConversation } from "@/types";

export function useProjectChat(
  projectId: string | null,
  onCardCreated?: () => void
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const segmentsRef = useRef<ChatSegment[]>([]);
  const activeConversationIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const fetchConversations = useCallback(async () => {
    if (!projectId) return;
    const res = await fetch("/api/project-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_conversations", projectId }),
    });
    const data = await res.json();
    if (Array.isArray(data)) {
      setConversations(data);
      return data as ChatConversation[];
    }
    return [] as ChatConversation[];
  }, [projectId]);

  const fetchMessages = useCallback(async (conversationId?: string | null) => {
    if (!projectId) return;
    const params = new URLSearchParams({ projectId });
    if (conversationId) params.set("conversationId", conversationId);
    const res = await fetch(`/api/project-chat?${params}`);
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

  // Load conversations on mount, select most recent
  useEffect(() => {
    if (!projectId) return;

    const init = async () => {
      const convs = await fetchConversations();
      await fetchAgentStatus();

      if (convs && convs.length > 0) {
        setActiveConversationId(convs[0].id);
        await fetchMessages(convs[0].id);
      } else {
        setMessages([]);
        setActiveConversationId(null);
      }
    };
    init();
  }, [projectId, fetchConversations, fetchMessages, fetchAgentStatus]);

  // Socket.IO for real-time updates
  useEffect(() => {
    if (!projectId) return;

    const socket = io(getSocketUrl());
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join:project", projectId);
    });

    socket.on("agent:output", (data) => {
      if (data.projectId !== projectId) return;
      // Only show output for the active conversation
      if (data.conversationId && data.conversationId !== activeConversationIdRef.current) return;

      if (data.type === "system") {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            cardId: null,
            projectId,
            conversationId: data.conversationId || null,
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
              conversationId: data.conversationId || null,
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
            conversationId: data.conversationId || null,
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
  }, [projectId]);

  const sendMessage = async (content: string) => {
    if (!projectId) return;

    // Optimistic update
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        cardId: null,
        projectId,
        conversationId: activeConversationId,
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
          conversationId: activeConversationId,
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
      } else if (data.conversationId && data.conversationId !== activeConversationId) {
        // A new conversation was created
        setActiveConversationId(data.conversationId);
        fetchConversations();
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

  const selectConversation = useCallback(async (conversationId: string) => {
    setActiveConversationId(conversationId);
    setStreaming(false);
    segmentsRef.current = [];
    await fetchMessages(conversationId);
  }, [fetchMessages]);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setStreaming(false);
    segmentsRef.current = [];
  }, []);

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!projectId) return;
    await fetch("/api/project-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_conversation",
        projectId,
        conversationId,
      }),
    });

    // If we deleted the active conversation, clear the view
    if (conversationId === activeConversationId) {
      setActiveConversationId(null);
      setMessages([]);
    }

    // Refresh conversation list
    await fetchConversations();
  }, [projectId, activeConversationId, fetchConversations]);

  const clearChat = async () => {
    if (!projectId) return;
    await fetch("/api/project-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear", projectId }),
    });
    setMessages([]);
    setConversations([]);
    setActiveConversationId(null);
    setStreaming(false);
    setAgentRunning(false);
  };

  return {
    messages,
    conversations,
    activeConversationId,
    agentRunning,
    streaming,
    sendMessage,
    selectConversation,
    startNewConversation,
    deleteConversation,
    clearChat,
    refreshConversations: fetchConversations,
  };
}
