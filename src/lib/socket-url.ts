/**
 * Client-side Socket.IO URL helper.
 *
 * Reads NEXT_PUBLIC_SOCKET_URL at build time (Next.js inlines it).
 * Falls back to localhost:3001 for local development.
 */
export function getSocketUrl(): string {
  return process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
}
