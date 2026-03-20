"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getUserIdentity, type UserIdentity } from "@/lib/identity";
import type { PresenceUser, CardLock } from "@/types";

interface UsePresenceOptions {
  projectId: string;
}

interface PresenceState {
  /** All users on this board */
  users: PresenceUser[];
  /** Map of cardId → users viewing that card */
  cardViewers: Record<string, PresenceUser[]>;
  /** Map of cardId → lock info (user currently dragging) */
  cardLocks: Record<string, CardLock>;
  /** The current user's identity */
  currentUser: UserIdentity;
  /** Notify that the current user started viewing a card */
  viewCard: (cardId: string) => void;
  /** Notify that the current user stopped viewing a card */
  unviewCard: (cardId: string) => void;
  /** Lock a card (drag start) */
  lockCard: (cardId: string) => void;
  /** Unlock a card (drag end) */
  unlockCard: (cardId: string) => void;
  /** Check if a card is locked by someone else */
  isLockedByOther: (cardId: string) => boolean;
  /** Get the lock holder for a card */
  getLockHolder: (cardId: string) => PresenceUser | null;
}

export function usePresence({ projectId }: UsePresenceOptions): PresenceState {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [cardViewers, setCardViewers] = useState<Record<string, PresenceUser[]>>({});
  const [cardLocks, setCardLocks] = useState<Record<string, CardLock>>({});
  const socketRef = useRef<Socket | null>(null);
  const identityRef = useRef<UserIdentity>(getUserIdentity());

  useEffect(() => {
    const identity = identityRef.current;
    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.on("connect", () => {
      // Join the project presence room and announce ourselves
      socket.emit("presence:join", {
        projectId,
        user: {
          id: identity.id,
          name: identity.name,
          color: identity.color,
        },
      });
    });

    // Full user list update
    socket.on("presence:users", (data: { users: PresenceUser[] }) => {
      setUsers(data.users);
    });

    // A user joined
    socket.on("presence:user-joined", (data: { user: PresenceUser }) => {
      setUsers((prev) => {
        if (prev.find((u) => u.id === data.user.id)) return prev;
        return [...prev, data.user];
      });
    });

    // A user left
    socket.on("presence:user-left", (data: { userId: string }) => {
      setUsers((prev) => prev.filter((u) => u.id !== data.userId));
      // Clean up any card viewers/locks for this user
      setCardViewers((prev) => {
        const next = { ...prev };
        for (const cardId of Object.keys(next)) {
          next[cardId] = next[cardId].filter((u) => u.id !== data.userId);
          if (next[cardId].length === 0) delete next[cardId];
        }
        return next;
      });
      setCardLocks((prev) => {
        const next = { ...prev };
        for (const cardId of Object.keys(next)) {
          if (next[cardId].userId === data.userId) delete next[cardId];
        }
        return next;
      });
    });

    // Card view updates
    socket.on("presence:card-viewers", (data: { cardId: string; viewers: PresenceUser[] }) => {
      setCardViewers((prev) => {
        const filtered = data.viewers.filter((u) => u.id !== identity.id);
        if (filtered.length === 0) {
          const next = { ...prev };
          delete next[data.cardId];
          return next;
        }
        return { ...prev, [data.cardId]: filtered };
      });
    });

    // Card lock updates
    socket.on("presence:card-locked", (data: { cardId: string; lock: CardLock }) => {
      setCardLocks((prev) => ({ ...prev, [data.cardId]: data.lock }));
    });

    socket.on("presence:card-unlocked", (data: { cardId: string }) => {
      setCardLocks((prev) => {
        const next = { ...prev };
        delete next[data.cardId];
        return next;
      });
    });

    return () => {
      socket.emit("presence:leave", { projectId, userId: identity.id });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId]);

  const viewCard = useCallback((cardId: string) => {
    socketRef.current?.emit("presence:view-card", {
      projectId,
      cardId,
      user: {
        id: identityRef.current.id,
        name: identityRef.current.name,
        color: identityRef.current.color,
      },
    });
  }, [projectId]);

  const unviewCard = useCallback((cardId: string) => {
    socketRef.current?.emit("presence:unview-card", {
      projectId,
      cardId,
      userId: identityRef.current.id,
    });
  }, [projectId]);

  const lockCard = useCallback((cardId: string) => {
    socketRef.current?.emit("presence:lock-card", {
      projectId,
      cardId,
      user: {
        id: identityRef.current.id,
        name: identityRef.current.name,
        color: identityRef.current.color,
      },
    });
  }, [projectId]);

  const unlockCard = useCallback((cardId: string) => {
    socketRef.current?.emit("presence:unlock-card", {
      projectId,
      cardId,
      userId: identityRef.current.id,
    });
  }, [projectId]);

  const isLockedByOther = useCallback((cardId: string): boolean => {
    const lock = cardLocks[cardId];
    return !!lock && lock.userId !== identityRef.current.id;
  }, [cardLocks]);

  const getLockHolder = useCallback((cardId: string): PresenceUser | null => {
    const lock = cardLocks[cardId];
    if (!lock || lock.userId === identityRef.current.id) return null;
    return users.find((u) => u.id === lock.userId) || null;
  }, [cardLocks, users]);

  return {
    users,
    cardViewers,
    cardLocks,
    currentUser: identityRef.current,
    viewCard,
    unviewCard,
    lockCard,
    unlockCard,
    isLockedByOther,
    getLockHolder,
  };
}
