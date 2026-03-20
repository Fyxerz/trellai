import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Tests for presence state management logic.
 * We extract and test the core state logic independently of Socket.IO.
 */

// ─── Replicate the server state management for testing ───────
interface PresenceUser {
  id: string;
  name: string;
  color: string;
  socketId: string;
}

interface CardLock {
  userId: string;
  userName: string;
  userColor: string;
  lockedAt: number;
}

// State stores (mirrors server.ts)
let projectUsers: Map<string, Map<string, PresenceUser>>;
let cardViewersState: Map<string, Map<string, Map<string, PresenceUser>>>;
let cardLocksState: Map<string, Map<string, CardLock>>;

function getProjectUsers(projectId: string) {
  if (!projectUsers.has(projectId)) projectUsers.set(projectId, new Map());
  return projectUsers.get(projectId)!;
}

function getCardViewers(projectId: string) {
  if (!cardViewersState.has(projectId)) cardViewersState.set(projectId, new Map());
  return cardViewersState.get(projectId)!;
}

function getCardLocks(projectId: string) {
  if (!cardLocksState.has(projectId)) cardLocksState.set(projectId, new Map());
  return cardLocksState.get(projectId)!;
}

function addUser(projectId: string, user: PresenceUser) {
  getProjectUsers(projectId).set(user.id, user);
}

function removeUser(projectId: string, userId: string) {
  getProjectUsers(projectId).delete(userId);

  // Clean up card viewers
  const viewers = getCardViewers(projectId);
  for (const [cardId, cardMap] of viewers) {
    cardMap.delete(userId);
    if (cardMap.size === 0) viewers.delete(cardId);
  }

  // Clean up locks
  const locks = getCardLocks(projectId);
  const removedLockCardIds: string[] = [];
  for (const [cardId, lock] of locks) {
    if (lock.userId === userId) {
      locks.delete(cardId);
      removedLockCardIds.push(cardId);
    }
  }
  return removedLockCardIds;
}

function viewCard(projectId: string, cardId: string, user: PresenceUser) {
  const viewers = getCardViewers(projectId);
  if (!viewers.has(cardId)) viewers.set(cardId, new Map());
  viewers.get(cardId)!.set(user.id, user);
}

function unviewCard(projectId: string, cardId: string, userId: string) {
  const viewers = getCardViewers(projectId);
  const cardMap = viewers.get(cardId);
  if (cardMap) {
    cardMap.delete(userId);
    if (cardMap.size === 0) viewers.delete(cardId);
  }
}

function lockCard(projectId: string, cardId: string, user: { id: string; name: string; color: string }): CardLock | "rejected" {
  const locks = getCardLocks(projectId);
  const existing = locks.get(cardId);
  if (existing && existing.userId !== user.id) return "rejected";

  const lock: CardLock = {
    userId: user.id,
    userName: user.name,
    userColor: user.color,
    lockedAt: Date.now(),
  };
  locks.set(cardId, lock);
  return lock;
}

function unlockCard(projectId: string, cardId: string, userId: string): boolean {
  const locks = getCardLocks(projectId);
  const lock = locks.get(cardId);
  if (lock && lock.userId === userId) {
    locks.delete(cardId);
    return true;
  }
  return false;
}

// ─── Tests ───────────────────────────────────────────────────

describe("Presence state management", () => {
  beforeEach(() => {
    projectUsers = new Map();
    cardViewersState = new Map();
    cardLocksState = new Map();
  });

  const user1: PresenceUser = { id: "u1", name: "Alice", color: "#8B5CF6", socketId: "s1" };
  const user2: PresenceUser = { id: "u2", name: "Bob", color: "#3B82F6", socketId: "s2" };
  const projectId = "proj-1";

  describe("user tracking", () => {
    it("adds users to a project", () => {
      addUser(projectId, user1);
      addUser(projectId, user2);
      const users = getProjectUsers(projectId);
      expect(users.size).toBe(2);
      expect(users.get("u1")?.name).toBe("Alice");
      expect(users.get("u2")?.name).toBe("Bob");
    });

    it("removes users from a project", () => {
      addUser(projectId, user1);
      addUser(projectId, user2);
      removeUser(projectId, "u1");
      const users = getProjectUsers(projectId);
      expect(users.size).toBe(1);
      expect(users.has("u1")).toBe(false);
      expect(users.has("u2")).toBe(true);
    });

    it("handles removing non-existent user gracefully", () => {
      addUser(projectId, user1);
      removeUser(projectId, "nonexistent");
      expect(getProjectUsers(projectId).size).toBe(1);
    });

    it("supports multiple projects independently", () => {
      addUser("proj-a", user1);
      addUser("proj-b", user2);
      expect(getProjectUsers("proj-a").size).toBe(1);
      expect(getProjectUsers("proj-b").size).toBe(1);
      expect(getProjectUsers("proj-a").get("u1")?.name).toBe("Alice");
      expect(getProjectUsers("proj-b").get("u2")?.name).toBe("Bob");
    });
  });

  describe("card viewers", () => {
    it("tracks users viewing a card", () => {
      viewCard(projectId, "card-1", user1);
      viewCard(projectId, "card-1", user2);
      const viewers = getCardViewers(projectId).get("card-1");
      expect(viewers?.size).toBe(2);
    });

    it("removes viewer when they unview", () => {
      viewCard(projectId, "card-1", user1);
      viewCard(projectId, "card-1", user2);
      unviewCard(projectId, "card-1", "u1");
      const viewers = getCardViewers(projectId).get("card-1");
      expect(viewers?.size).toBe(1);
      expect(viewers?.has("u1")).toBe(false);
    });

    it("cleans up empty card viewer maps", () => {
      viewCard(projectId, "card-1", user1);
      unviewCard(projectId, "card-1", "u1");
      expect(getCardViewers(projectId).has("card-1")).toBe(false);
    });

    it("cleans up viewers when user is removed from project", () => {
      viewCard(projectId, "card-1", user1);
      viewCard(projectId, "card-2", user1);
      viewCard(projectId, "card-1", user2);
      removeUser(projectId, "u1");

      const card1Viewers = getCardViewers(projectId).get("card-1");
      expect(card1Viewers?.size).toBe(1);
      expect(card1Viewers?.has("u1")).toBe(false);

      // card-2 should be removed entirely since u1 was the only viewer
      expect(getCardViewers(projectId).has("card-2")).toBe(false);
    });

    it("tracks viewers across multiple cards", () => {
      viewCard(projectId, "card-1", user1);
      viewCard(projectId, "card-2", user2);
      expect(getCardViewers(projectId).get("card-1")?.size).toBe(1);
      expect(getCardViewers(projectId).get("card-2")?.size).toBe(1);
    });
  });

  describe("card locks", () => {
    it("allows locking an unlocked card", () => {
      const result = lockCard(projectId, "card-1", user1);
      expect(result).not.toBe("rejected");
      expect((result as CardLock).userId).toBe("u1");
    });

    it("rejects locking a card already locked by another user", () => {
      lockCard(projectId, "card-1", user1);
      const result = lockCard(projectId, "card-1", user2);
      expect(result).toBe("rejected");
    });

    it("allows re-locking by the same user", () => {
      lockCard(projectId, "card-1", user1);
      const result = lockCard(projectId, "card-1", user1);
      expect(result).not.toBe("rejected");
    });

    it("unlocks a card", () => {
      lockCard(projectId, "card-1", user1);
      const result = unlockCard(projectId, "card-1", "u1");
      expect(result).toBe(true);
      expect(getCardLocks(projectId).has("card-1")).toBe(false);
    });

    it("prevents unauthorized unlock", () => {
      lockCard(projectId, "card-1", user1);
      const result = unlockCard(projectId, "card-1", "u2");
      expect(result).toBe(false);
      expect(getCardLocks(projectId).has("card-1")).toBe(true);
    });

    it("cleans up locks when user is removed from project", () => {
      lockCard(projectId, "card-1", user1);
      lockCard(projectId, "card-2", user1);
      const removedLockCards = removeUser(projectId, "u1");
      expect(removedLockCards).toContain("card-1");
      expect(removedLockCards).toContain("card-2");
      expect(getCardLocks(projectId).size).toBe(0);
    });

    it("does not clean up other users' locks on removal", () => {
      lockCard(projectId, "card-1", user1);
      lockCard(projectId, "card-2", user2);
      removeUser(projectId, "u1");
      expect(getCardLocks(projectId).size).toBe(1);
      expect(getCardLocks(projectId).has("card-2")).toBe(true);
    });

    it("allows locking after previous holder disconnects", () => {
      lockCard(projectId, "card-1", user1);
      removeUser(projectId, "u1");
      const result = lockCard(projectId, "card-1", user2);
      expect(result).not.toBe("rejected");
      expect((result as CardLock).userId).toBe("u2");
    });
  });
});
