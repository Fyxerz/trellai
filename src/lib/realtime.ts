/**
 * Supabase Realtime broadcast adapter for cross-machine sync.
 *
 * In shared mode (storageMode === "supabase"), events are broadcast via
 * Supabase Realtime channels so other developers' local instances see
 * real-time updates (card moves, agent status, chat messages, presence).
 *
 * This is used alongside Socket.IO (which handles local orchestrator ↔ UI),
 * NOT as a replacement. Socket.IO stays for same-machine communication.
 */

import { createClient, RealtimeChannel } from "@supabase/supabase-js";

type EventCallback = (payload: Record<string, unknown>) => void;

class RealtimeSync {
  private client;
  private channels = new Map<string, RealtimeChannel>();
  private listeners = new Map<string, Map<string, Set<EventCallback>>>();

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      // No Supabase configured — realtime won't work, that's OK for local mode
      this.client = null;
      return;
    }

    this.client = createClient(url, key, {
      realtime: {
        params: { eventsPerSecond: 40 },
      },
    });
  }

  /**
   * Join a project's broadcast channel.
   * All events for this project will flow through this channel.
   */
  joinProject(projectId: string): void {
    if (!this.client) return;
    if (this.channels.has(projectId)) return;

    const channel = this.client.channel(`project:${projectId}`, {
      config: { broadcast: { self: false } },
    });

    // Listen for all broadcast events and dispatch to registered listeners
    channel.on("broadcast", { event: "*" }, (payload) => {
      const event = payload.event;
      const data = (payload.payload || {}) as Record<string, unknown>;
      const projectListeners = this.listeners.get(projectId);
      if (!projectListeners) return;

      const callbacks = projectListeners.get(event);
      if (callbacks) {
        for (const cb of callbacks) {
          try {
            cb(data);
          } catch (err) {
            console.error(`[realtime] Error in listener for ${event}:`, err);
          }
        }
      }
    });

    channel.subscribe();
    this.channels.set(projectId, channel);
  }

  /**
   * Leave a project's broadcast channel.
   */
  leaveProject(projectId: string): void {
    const channel = this.channels.get(projectId);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(projectId);
      this.listeners.delete(projectId);
    }
  }

  /**
   * Broadcast an event to all other instances watching this project.
   */
  broadcast(
    projectId: string,
    event: string,
    data: Record<string, unknown>
  ): void {
    const channel = this.channels.get(projectId);
    if (!channel) return;

    channel.send({
      type: "broadcast",
      event,
      payload: data,
    });
  }

  /**
   * Subscribe to events on a project channel.
   */
  on(projectId: string, event: string, callback: EventCallback): void {
    if (!this.listeners.has(projectId)) {
      this.listeners.set(projectId, new Map());
    }
    const projectListeners = this.listeners.get(projectId)!;
    if (!projectListeners.has(event)) {
      projectListeners.set(event, new Set());
    }
    projectListeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribe from events on a project channel.
   */
  off(projectId: string, event: string, callback: EventCallback): void {
    const projectListeners = this.listeners.get(projectId);
    if (!projectListeners) return;
    const callbacks = projectListeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Check if Supabase Realtime is available (configured).
   */
  get isAvailable(): boolean {
    return this.client !== null;
  }
}

// Singleton — survives hot reloads
const globalForRealtime = globalThis as unknown as {
  realtimeSync?: RealtimeSync;
};

export function getRealtimeSync(): RealtimeSync {
  if (!globalForRealtime.realtimeSync) {
    globalForRealtime.realtimeSync = new RealtimeSync();
  }
  return globalForRealtime.realtimeSync;
}
