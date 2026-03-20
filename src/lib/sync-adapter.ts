/**
 * Sync adapter — unifies Socket.IO (local) and Supabase Realtime (shared).
 *
 * In local mode: only Socket.IO is used (same-machine communication).
 * In shared mode: Socket.IO handles local orchestrator ↔ UI,
 *   AND Supabase Realtime broadcasts cross-machine events.
 *
 * The server-side emitters (in orchestrator) dual-emit:
 *   1. Socket.IO for the local UI
 *   2. Supabase Realtime for other devs' instances
 */

import { getRealtimeSync } from "./realtime";
import { emitToCard, emitToProject, emitGlobal } from "./socket";

/**
 * Emit an event to a card room — local Socket.IO + optional Supabase broadcast.
 */
export function syncEmitToCard(
  cardId: string,
  projectId: string,
  event: string,
  data: Record<string, unknown>
): void {
  // Always emit locally via Socket.IO
  emitToCard(cardId, event, data);

  // Also broadcast via Supabase Realtime if available
  const realtime = getRealtimeSync();
  if (realtime.isAvailable) {
    realtime.broadcast(projectId, event, { ...data, cardId });
  }
}

/**
 * Emit an event to a project room — local Socket.IO + optional Supabase broadcast.
 */
export function syncEmitToProject(
  projectId: string,
  event: string,
  data: Record<string, unknown>
): void {
  emitToProject(projectId, event, data);

  const realtime = getRealtimeSync();
  if (realtime.isAvailable) {
    realtime.broadcast(projectId, event, { ...data, projectId });
  }
}

/**
 * Emit a global event — local Socket.IO + optional Supabase broadcast.
 */
export function syncEmitGlobal(
  event: string,
  data: Record<string, unknown>,
  projectId?: string
): void {
  emitGlobal(event, data);

  if (projectId) {
    const realtime = getRealtimeSync();
    if (realtime.isAvailable) {
      realtime.broadcast(projectId, event, data);
    }
  }
}
