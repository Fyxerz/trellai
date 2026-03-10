import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

let cached: string | null = null;

export function resolveClaudePath(): string {
  if (cached) return cached;

  // Check CLAUDE_PATH env var first
  if (process.env.CLAUDE_PATH && existsSync(process.env.CLAUDE_PATH)) {
    cached = process.env.CLAUDE_PATH;
    return cached;
  }

  // Check common locations
  const home = process.env.HOME || "";
  const candidates = [
    join(home, ".local", "bin", "claude"),
    "/usr/local/bin/claude",
    "/usr/bin/claude",
  ];

  for (const p of candidates) {
    if (existsSync(p)) {
      cached = p;
      return p;
    }
  }

  // Fallback to which
  try {
    cached = execSync("which claude", { encoding: "utf-8" }).trim();
    return cached;
  } catch {}

  throw new Error(
    "Claude CLI not found. Install it or set CLAUDE_PATH env var."
  );
}
