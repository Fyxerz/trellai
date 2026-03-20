import { NextResponse } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";
export const dynamic = "force-dynamic";

export interface RateLimitEntry {
  resetsAt: number | null;
  status: "allowed" | "allowed_warning" | "rejected";
  rateLimitType: string;
  overageStatus?: string;
  isUsingOverage?: boolean;
  surpassedThreshold?: number;
}

export interface UsageData {
  fiveHour: RateLimitEntry | null;
  sevenDay: RateLimitEntry | null;
  totalCostUsd: number | null;
}

/**
 * GET /api/usage
 *
 * Spawns a minimal Claude SDK query to capture rate_limit_event messages,
 * which contain current rate limit status from Anthropic's servers.
 * No auth required — usage is tied to the local Claude CLI installation.
 */
export async function GET() {

  try {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 15000);

    const result: UsageData = {
      fiveHour: null,
      sevenDay: null,
      totalCostUsd: null,
    };

    const q = query({
      prompt: "Say exactly: ok",
      options: {
        maxTurns: 1,
        abortController,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
      },
    });

    for await (const msg of q) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = msg as any;

      if (m.type === "rate_limit_event" && m.rate_limit_info) {
        const info = m.rate_limit_info;
        const entry: RateLimitEntry = {
          resetsAt: info.resetsAt ?? null,
          status: info.status ?? "allowed",
          rateLimitType: info.rateLimitType ?? "unknown",
          overageStatus: info.overageStatus,
          isUsingOverage: info.isUsingOverage,
          surpassedThreshold: info.surpassedThreshold,
        };

        if (info.rateLimitType === "five_hour") {
          result.fiveHour = entry;
        } else if (
          info.rateLimitType === "seven_day" ||
          info.rateLimitType === "seven_day_opus" ||
          info.rateLimitType === "seven_day_sonnet"
        ) {
          result.sevenDay = entry;
        }
      }

      if (m.type === "result") {
        if (m.total_cost_usd !== undefined) {
          result.totalCostUsd = m.total_cost_usd;
        }
        break;
      }
    }

    clearTimeout(timeout);
    q.close();

    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/usage] Error fetching usage:", err);
    return NextResponse.json(
      { error: "Failed to fetch usage data" },
      { status: 500 }
    );
  }
}
