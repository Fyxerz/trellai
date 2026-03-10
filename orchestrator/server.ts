import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

const PORT = 3001;

const httpServer = createServer();
const io = new SocketServer(httpServer, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log(`[socket] Client connected: ${socket.id}`);

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

  socket.on("disconnect", () => {
    console.log(`[socket] Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[orchestrator] Socket.IO server listening on port ${PORT}`);
});
