import { io as ioClient, Socket } from "socket.io-client";

// Survive Next.js hot module reloads in dev mode
const globalForSocket = globalThis as unknown as { socketClient?: Socket };

export function getSocketClient(): Socket {
  if (!globalForSocket.socketClient) {
    globalForSocket.socketClient = ioClient("http://localhost:3001");
  }
  return globalForSocket.socketClient;
}

export function emitToCard(
  cardId: string,
  event: string,
  data: Record<string, unknown>
) {
  console.log(`[socket] emitToCard(${cardId}): ${event} type=${data.type || "n/a"}`);
  const socket = getSocketClient();
  // The sidecar server will broadcast to the card room
  socket.emit("server:broadcast", { room: `card:${cardId}`, event, data });
}

export function emitGlobal(
  event: string,
  data: Record<string, unknown>
) {
  const socket = getSocketClient();
  socket.emit("server:broadcast-all", { event, data });
}

export function emitToProject(
  projectId: string,
  event: string,
  data: Record<string, unknown>
) {
  console.log(`[socket] emitToProject(${projectId}): ${event} type=${data.type || "n/a"}`);
  const socket = getSocketClient();
  socket.emit("server:broadcast", { room: `project:${projectId}`, event, data });
}
