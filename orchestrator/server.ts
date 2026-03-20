import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

const PORT = parseInt(process.env.SOCKET_PORT || "3001", 10);
const LOCK_TIMEOUT_MS = 30_000; // 30 seconds safety net for stale locks

// Parse allowed CORS origins from env (comma-separated) or default to "*"
const CORS_ORIGINS = process.env.SOCKET_CORS_ORIGINS
  ? process.env.SOCKET_CORS_ORIGINS.split(",").map((s) => s.trim())
  : ["*"];

// ─── Presence state ─────────────────────────────────────────────
interface PresenceUser {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
  socketId: string;
}

interface CardLock {
  userId: string;
  userName: string;
  userColor: string;
  lockedAt: number;
}

// projectId → Map<userId, PresenceUser>
const projectUsers = new Map<string, Map<string, PresenceUser>>();

// projectId → cardId → Map<userId, PresenceUser>
const cardViewers = new Map<string, Map<string, Map<string, PresenceUser>>>();

// projectId → cardId → CardLock
const cardLocks = new Map<string, Map<string, CardLock>>();

// socketId → { projectId, userId }
const socketToUser = new Map<string, { projectId: string; userId: string }>();

function getProjectUsers(projectId: string) {
  if (!projectUsers.has(projectId)) projectUsers.set(projectId, new Map());
  return projectUsers.get(projectId)!;
}

function getCardViewers(projectId: string) {
  if (!cardViewers.has(projectId)) cardViewers.set(projectId, new Map());
  return cardViewers.get(projectId)!;
}

function getCardLocks(projectId: string) {
  if (!cardLocks.has(projectId)) cardLocks.set(projectId, new Map());
  return cardLocks.get(projectId)!;
}

function toPresencePayload({ id, name, color, avatarUrl }: PresenceUser) {
  return { id, name, color, avatarUrl: avatarUrl || null };
}

function broadcastUsers(io: InstanceType<typeof SocketServer>, projectId: string) {
  const users = Array.from(getProjectUsers(projectId).values()).map(toPresencePayload);
  io.to(`presence:${projectId}`).emit("presence:users", { users });
}

function broadcastCardViewers(io: InstanceType<typeof SocketServer>, projectId: string, cardId: string) {
  const viewers = getCardViewers(projectId).get(cardId);
  const list = viewers ? Array.from(viewers.values()).map(toPresencePayload) : [];
  io.to(`presence:${projectId}`).emit("presence:card-viewers", { cardId, viewers: list });
}

function cleanupUser(io: InstanceType<typeof SocketServer>, projectId: string, userId: string) {
  // Remove from project users
  const users = getProjectUsers(projectId);
  users.delete(userId);

  // Remove from all card viewers in this project
  const projectCardViewers = getCardViewers(projectId);
  for (const [cardId, viewers] of projectCardViewers) {
    if (viewers.delete(userId)) {
      broadcastCardViewers(io, projectId, cardId);
    }
    if (viewers.size === 0) projectCardViewers.delete(cardId);
  }

  // Remove any locks held by this user
  const locks = getCardLocks(projectId);
  for (const [cardId, lock] of locks) {
    if (lock.userId === userId) {
      locks.delete(cardId);
      io.to(`presence:${projectId}`).emit("presence:card-unlocked", { cardId });
    }
  }

  // Broadcast user left
  io.to(`presence:${projectId}`).emit("presence:user-left", { userId });
}
// ─── End presence state ──────────────────────────────────────────

const httpServer = createServer();
const io = new SocketServer(httpServer, {
  cors: {
    origin: CORS_ORIGINS.length === 1 && CORS_ORIGINS[0] === "*" ? "*" : CORS_ORIGINS,
  },
});

// Periodic cleanup of stale locks
setInterval(() => {
  const now = Date.now();
  for (const [projectId, locks] of cardLocks) {
    for (const [cardId, lock] of locks) {
      if (now - lock.lockedAt > LOCK_TIMEOUT_MS) {
        locks.delete(cardId);
        io.to(`presence:${projectId}`).emit("presence:card-unlocked", { cardId });
        console.log(`[presence] Stale lock cleaned up: card=${cardId} user=${lock.userId}`);
      }
    }
  }
}, 10_000);

io.on("connection", (socket) => {
  console.log(`[socket] Client connected: ${socket.id}`);

  // ─── Existing room events ──────────────────────────────────
  socket.on("join:card", (cardId: string) => {
    socket.join(`card:${cardId}`);
  });

  socket.on("leave:card", (cardId: string) => {
    socket.leave(`card:${cardId}`);
  });

  socket.on("join:project", (projectId: string) => {
    socket.join(`project:${projectId}`);
  });

  socket.on("leave:project", (projectId: string) => {
    socket.leave(`project:${projectId}`);
  });

  // Server-side broadcast relay: Next.js API sends this to broadcast to card rooms
  socket.on("server:broadcast", (data: { room: string; event: string; data: Record<string, unknown> }) => {
    io.to(data.room).emit(data.event, data.data);
  });

  // Global broadcast relay: broadcasts to ALL connected clients (e.g. usage updates)
  socket.on("server:broadcast-all", (data: { event: string; data: Record<string, unknown> }) => {
    io.emit(data.event, data.data);
  });

  // ─── Presence events ───────────────────────────────────────
  socket.on("presence:join", (data: { projectId: string; user: { id: string; name: string; color: string; avatarUrl?: string | null } }) => {
    const { projectId, user } = data;

    // Track socket → user mapping for disconnect cleanup
    socketToUser.set(socket.id, { projectId, userId: user.id });

    // Join presence room
    socket.join(`presence:${projectId}`);

    // Add user to project presence
    const users = getProjectUsers(projectId);
    users.set(user.id, { ...user, socketId: socket.id });

    // Broadcast updated user list
    broadcastUsers(io, projectId);

    // Send current card viewers and locks to the new user
    const projectViewers = getCardViewers(projectId);
    for (const [cardId, viewers] of projectViewers) {
      const list = Array.from(viewers.values()).map(toPresencePayload);
      socket.emit("presence:card-viewers", { cardId, viewers: list });
    }

    const locks = getCardLocks(projectId);
    for (const [cardId, lock] of locks) {
      socket.emit("presence:card-locked", { cardId, lock });
    }

    console.log(`[presence] User joined: ${user.name} (${user.id}) → project ${projectId}`);
  });

  socket.on("presence:leave", (data: { projectId: string; userId: string }) => {
    cleanupUser(io, data.projectId, data.userId);
    socketToUser.delete(socket.id);
    socket.leave(`presence:${data.projectId}`);
    console.log(`[presence] User left: ${data.userId} → project ${data.projectId}`);
  });

  socket.on("presence:view-card", (data: { projectId: string; cardId: string; user: { id: string; name: string; color: string; avatarUrl?: string | null } }) => {
    const { projectId, cardId, user } = data;
    const projectViewers = getCardViewers(projectId);
    if (!projectViewers.has(cardId)) projectViewers.set(cardId, new Map());
    projectViewers.get(cardId)!.set(user.id, { ...user, socketId: socket.id });
    broadcastCardViewers(io, projectId, cardId);
  });

  socket.on("presence:unview-card", (data: { projectId: string; cardId: string; userId: string }) => {
    const { projectId, cardId, userId } = data;
    const projectViewers = getCardViewers(projectId);
    const viewers = projectViewers.get(cardId);
    if (viewers) {
      viewers.delete(userId);
      if (viewers.size === 0) projectViewers.delete(cardId);
      broadcastCardViewers(io, projectId, cardId);
    }
  });

  socket.on("presence:lock-card", (data: { projectId: string; cardId: string; user: { id: string; name: string; color: string; avatarUrl?: string | null } }) => {
    const { projectId, cardId, user } = data;
    const locks = getCardLocks(projectId);

    // Only allow lock if not already locked by someone else
    const existing = locks.get(cardId);
    if (existing && existing.userId !== user.id) {
      // Card is already locked by another user — reject
      socket.emit("presence:lock-rejected", { cardId, lock: existing });
      return;
    }

    const lock: CardLock = {
      userId: user.id,
      userName: user.name,
      userColor: user.color,
      lockedAt: Date.now(),
    };
    locks.set(cardId, lock);
    io.to(`presence:${projectId}`).emit("presence:card-locked", { cardId, lock });
  });

  socket.on("presence:unlock-card", (data: { projectId: string; cardId: string; userId: string }) => {
    const { projectId, cardId, userId } = data;
    const locks = getCardLocks(projectId);
    const lock = locks.get(cardId);

    // Only the user who locked it can unlock it
    if (lock && lock.userId === userId) {
      locks.delete(cardId);
      io.to(`presence:${projectId}`).emit("presence:card-unlocked", { cardId });
    }
  });

  // ─── Disconnect ────────────────────────────────────────────
  socket.on("disconnect", () => {
    const mapping = socketToUser.get(socket.id);
    if (mapping) {
      cleanupUser(io, mapping.projectId, mapping.userId);
      socketToUser.delete(socket.id);
    }
    console.log(`[socket] Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[orchestrator] Socket.IO server listening on 0.0.0.0:${PORT}`);
});
