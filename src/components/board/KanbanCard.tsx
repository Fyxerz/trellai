"use client";
import { Draggable } from "@hello-pangea/dnd";
import { Calendar, GitBranch, CheckSquare } from "lucide-react";
import type { Card } from "@/types";

const statusBadge: Record<
  string,
  { label: string; bg: string; text: string; glow?: boolean }
> = {
  idle: { label: "Planned", bg: "bg-slate-400/20", text: "text-slate-300" },
  running: { label: "Running", bg: "bg-blue-400/20", text: "text-blue-300" },
  awaiting_feedback: { label: "Needs Input", bg: "bg-amber-400/20", text: "text-amber-300", glow: true },
  ready_for_dev: { label: "Ready", bg: "bg-emerald-400/20", text: "text-emerald-300" },
  dev_complete: { label: "Dev Complete", bg: "bg-purple-400/20", text: "text-purple-300" },
  error: { label: "Error", bg: "bg-red-400/20", text: "text-red-300" },
  complete: { label: "Complete", bg: "bg-emerald-400/20", text: "text-emerald-300" },
  merged: { label: "Merged", bg: "bg-emerald-400/20", text: "text-emerald-300" },
  queued: { label: "Queued", bg: "bg-yellow-400/20", text: "text-yellow-300" },
  reverted: { label: "Reverted", bg: "bg-orange-400/20", text: "text-orange-300" },
};

const typeBadge: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  feature: { label: "Feature", bg: "bg-amber-500/25", text: "text-amber-300" },
  fix: { label: "Fix", bg: "bg-rose-500/25", text: "text-rose-300" },
};

interface KanbanCardProps {
  card: Card;
  index: number;
  onClick: () => void;
}

export function KanbanCard({ card, index, onClick }: KanbanCardProps) {
  const badge = typeBadge[card.type] || typeBadge.feature;
  const status = statusBadge[card.agentStatus] || statusBadge.idle;
  const isRunning = card.agentStatus === "running";
  const needsAttention = card.agentStatus === "awaiting_feedback";
  const isReadyForDev = card.agentStatus === "ready_for_dev";
  const isDevComplete = card.agentStatus === "dev_complete";

  const dateStr = new Date(card.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`glass-card rounded-xl p-4 cursor-pointer transition-all duration-200 ${
            snapshot.isDragging
              ? "shadow-2xl shadow-black/30 ring-1 ring-white/20 scale-[1.02]"
              : needsAttention
              ? "attention-glow"
              : isReadyForDev
              ? "ring-1 ring-emerald-400/40"
              : isDevComplete
              ? "ring-1 ring-purple-400/40"
              : ""
          }`}
        >
          {/* Top row: badge + title */}
          <div className="flex items-start gap-2">
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${badge.bg} ${badge.text}`}
            >
              {badge.label}
            </span>
            <h3 className="text-sm font-semibold leading-snug text-white/90">
              {card.title}
            </h3>
          </div>

          {/* Description */}
          {card.description && (
            <p className="mt-2 text-[13px] leading-relaxed text-white/45 line-clamp-2">
              {card.description}
            </p>
          )}

          {/* Checklist progress */}
          {(card.checklistTotal ?? 0) > 0 && (
            <div className="mt-2.5 flex items-center gap-2">
              <CheckSquare className="h-3 w-3 text-white/30 shrink-0" />
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.round(((card.checklistChecked ?? 0) / card.checklistTotal!) * 100)}%`,
                    background:
                      card.checklistChecked === card.checklistTotal
                        ? "rgb(52, 211, 153)"
                        : "linear-gradient(to right, rgb(139, 92, 246), rgb(99, 102, 241))",
                  }}
                />
              </div>
              <span className="text-[11px] text-white/30">
                {card.checklistChecked}/{card.checklistTotal}
              </span>
            </div>
          )}

          {/* Progress bar for running agents */}
          {isRunning && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-2/3 rounded-full progress-shimmer" />
              </div>
              <span className="text-[11px] text-white/40">active</span>
            </div>
          )}

          {/* Bottom row: status + branch/date */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {card.agentStatus !== "idle" && (
                <span
                  className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${status.bg} ${status.text}`}
                >
                  {isRunning && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
                    </span>
                  )}
                  {needsAttention && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                    </span>
                  )}
                  {status.label}
                </span>
              )}
              {card.branchName && (
                <span className="flex items-center gap-1 text-[10px] text-white/30">
                  <GitBranch className="h-2.5 w-2.5" />
                </span>
              )}
            </div>
            <span className="flex items-center gap-1 text-[11px] text-white/30">
              <Calendar className="h-3 w-3" />
              {dateStr}
            </span>
          </div>
        </div>
      )}
    </Draggable>
  );
}
