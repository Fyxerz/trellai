"use client";
import { useUsage } from "@/hooks/useUsage";
import type { RateLimitEntry } from "@/app/api/usage/route";

function statusColor(status: RateLimitEntry["status"]) {
  switch (status) {
    case "allowed":
      return "text-emerald-400";
    case "allowed_warning":
      return "text-amber-400";
    case "rejected":
      return "text-red-400";
  }
}

function statusDotColor(status: RateLimitEntry["status"]) {
  switch (status) {
    case "allowed":
      return "bg-emerald-400";
    case "allowed_warning":
      return "bg-amber-400";
    case "rejected":
      return "bg-red-400";
  }
}

function statusLabel(status: RateLimitEntry["status"]) {
  switch (status) {
    case "allowed":
      return "OK";
    case "allowed_warning":
      return "Warning";
    case "rejected":
      return "Limit Hit";
  }
}

function formatResetTime(resetsAt: number | null): string {
  if (!resetsAt) return "Unknown reset time";
  const now = Date.now() / 1000; // convert to seconds
  const diff = resetsAt - now;
  if (diff <= 0) return "Resetting now...";

  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (hours > 0) return `Resets in ${hours}h ${minutes}m`;
  return `Resets in ${minutes}m`;
}

function formatLimitType(type: string): string {
  switch (type) {
    case "five_hour":
      return "5h";
    case "seven_day":
    case "seven_day_opus":
    case "seven_day_sonnet":
      return "7d";
    default:
      return type;
  }
}

function StatusBadge({ entry }: { entry: RateLimitEntry }) {
  const label = formatLimitType(entry.rateLimitType);
  const tooltip = `${label} rate limit: ${statusLabel(entry.status)}\n${formatResetTime(entry.resetsAt)}${entry.surpassedThreshold ? `\nThreshold: ${Math.round(entry.surpassedThreshold * 100)}%` : ""}`;

  return (
    <div className="flex items-center gap-1.5 cursor-default" title={tooltip}>
      <span
        className={`h-2 w-2 rounded-full ${statusDotColor(entry.status)} ${
          entry.status === "allowed_warning" ? "animate-pulse" : ""
        } ${entry.status === "rejected" ? "animate-pulse" : ""}`}
      />
      <span
        className={`text-xs font-medium ${statusColor(entry.status)}`}
      >
        {label}: {statusLabel(entry.status)}
      </span>
    </div>
  );
}

export function UsageCounter() {
  const usage = useUsage();

  if (usage.loading) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-1.5">
        <span className="text-xs text-white/30">Loading usage...</span>
      </div>
    );
  }

  if (usage.error && !usage.fiveHour && !usage.sevenDay) {
    return null;
  }

  const hasData = usage.fiveHour || usage.sevenDay || usage.sessionCostUsd > 0;
  if (!hasData) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-1.5 border border-white/8">
      {usage.fiveHour && <StatusBadge entry={usage.fiveHour} />}
      {usage.fiveHour && usage.sevenDay && (
        <div className="h-3 w-px bg-white/10" />
      )}
      {usage.sevenDay && <StatusBadge entry={usage.sevenDay} />}
      {usage.sessionCostUsd > 0 && (
        <>
          <div className="h-3 w-px bg-white/10" />
          <span
            className="text-xs font-medium text-white/50 tabular-nums cursor-default"
            title={`Session cost: $${usage.sessionCostUsd.toFixed(4)}`}
          >
            ${usage.sessionCostUsd.toFixed(2)}
          </span>
        </>
      )}
    </div>
  );
}
