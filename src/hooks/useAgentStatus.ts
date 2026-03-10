"use client";
import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { Card } from "@/types";

export function useAgentStatus(cards: Card[]) {
  const [statuses, setStatuses] = useState<
    Record<string, { running: boolean }>
  >({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const activeCards = cards.filter((c) => c.column === "production" || c.column === "features");
    if (activeCards.length === 0) return;

    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.on("connect", () => {
      for (const card of activeCards) {
        socket.emit("join:card", card.id);
      }
    });

    socket.on("agent:status", (data) => {
      setStatuses((prev) => ({
        ...prev,
        [data.cardId]: { running: data.status === "running", status: data.status },
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [cards]);

  return statuses;
}
