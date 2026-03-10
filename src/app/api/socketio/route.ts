import { NextResponse } from "next/server";

// Socket.IO runs as a separate process on port 3001
// This route just provides the client with the connection info
export async function GET() {
  return NextResponse.json({
    socketUrl: "http://localhost:3001",
    status: "ok",
  });
}
