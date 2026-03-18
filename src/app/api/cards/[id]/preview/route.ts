import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import net from "net";

const repos = getLocalRepositories();

const previewServers = new Map<
  string,
  { process: ChildProcess; port: number }
>();

async function findAvailablePort(start = 3002): Promise<number> {
  for (let port = start; port < start + 100; port++) {
    if (port === 3000 || port === 3001) continue;
    const available = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close();
        resolve(true);
      });
      server.listen(port);
    });
    if (available) return port;
  }
  throw new Error("No available port found");
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cardId } = await params;

  // Check if already running
  const existing = previewServers.get(cardId);
  if (existing) {
    return NextResponse.json({
      port: existing.port,
      url: `http://localhost:${existing.port}`,
    });
  }

  const card = repos.cards.findById(cardId);
  if (!card?.worktreePath) {
    return NextResponse.json(
      { error: "No worktree path for this card" },
      { status: 400 }
    );
  }

  // Read package.json to detect framework
  const pkgPath = path.join(card.worktreePath, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return NextResponse.json(
      { error: "No package.json found in worktree" },
      { status: 400 }
    );
  }

  const port = await findAvailablePort();

  // Spawn dev server with port flag
  const proc = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
    cwd: card.worktreePath,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port) },
    detached: true,
  });

  proc.unref();

  previewServers.set(cardId, { process: proc, port });

  proc.on("exit", () => {
    previewServers.delete(cardId);
  });

  return NextResponse.json({
    port,
    url: `http://localhost:${port}`,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cardId } = await params;

  const server = previewServers.get(cardId);
  if (server) {
    try {
      // Kill the process group
      if (server.process.pid) {
        process.kill(-server.process.pid, "SIGTERM");
      }
    } catch {
      server.process.kill("SIGTERM");
    }
    previewServers.delete(cardId);
  }

  return NextResponse.json({ success: true });
}

// Export for use by orchestrator when cards move out of review
export function stopPreviewServer(cardId: string) {
  const server = previewServers.get(cardId);
  if (server) {
    try {
      if (server.process.pid) {
        process.kill(-server.process.pid, "SIGTERM");
      }
    } catch {
      server.process.kill("SIGTERM");
    }
    previewServers.delete(cardId);
  }
}
