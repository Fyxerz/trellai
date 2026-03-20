"use client";
import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getSocketUrl } from "@/lib/socket-url";
import type { RateLimitEntry, UsageData } from "@/app/api/usage/route";

export interface UsageState {
  fiveHour: RateLimitEntry | null;
  sevenDay: RateLimitEntry | null;
  /** Accumulated cost across all agent sessions since page load */
  sessionCostUsd: number;
  loading: boolean;
  error: string | null;
}

export function useUsage(): UsageState {
  const [state, setState] = useState<UsageState>({
    fiveHour: null,
    sevenDay: null,
    sessionCostUsd: 0,
    loading: true,
    error: null,
  });
  const socketRef = useRef<Socket | null>(null);

  // Fetch initial usage data on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchUsage() {
      try {
        const res = await fetch("/api/usage");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: UsageData = await res.json();
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            fiveHour: data.fiveHour,
            sevenDay: data.sevenDay,
            loading: false,
          }));
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          }));
        }
      }
    }

    fetchUsage();
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to live usage updates via Socket.IO
  useEffect(() => {
    const socket = io(getSocketUrl());
    socketRef.current = socket;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on("usage:updated", (data: any) => {
      if (data.type === "rate_limit" && data.rateLimitInfo) {
        const info = data.rateLimitInfo;
        const entry: RateLimitEntry = {
          resetsAt: info.resetsAt ?? null,
          status: info.status ?? "allowed",
          rateLimitType: info.rateLimitType ?? "unknown",
          overageStatus: info.overageStatus,
          isUsingOverage: info.isUsingOverage,
          surpassedThreshold: info.surpassedThreshold,
        };

        setState((prev) => {
          if (info.rateLimitType === "five_hour") {
            return { ...prev, fiveHour: entry };
          } else if (
            info.rateLimitType === "seven_day" ||
            info.rateLimitType === "seven_day_opus" ||
            info.rateLimitType === "seven_day_sonnet"
          ) {
            return { ...prev, sevenDay: entry };
          }
          return prev;
        });
      }

      if (data.type === "cost" && typeof data.totalCostUsd === "number") {
        setState((prev) => ({
          ...prev,
          sessionCostUsd: prev.sessionCostUsd + data.totalCostUsd,
        }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return state;
}
