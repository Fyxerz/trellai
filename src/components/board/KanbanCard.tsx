"use client";
import { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Calendar, GitBranch, CheckSquare, FlaskConical, Lock, Snowflake } from "lucide-react";
import { CardPresenceAvatars } from "./CardPresenceAvatars";
import type { Card, TestResults, PresenceUser, CardLock } from "@/types";

const statusBadge: Record<
  string,
  { label: string; bg: string; text: string; glow?: boolean }
> = {
  idle: { label: "Planned", bg: "bg-slate-400/20", text: "text-slate-300" },
  running: { label: "Running", bg: "bg-blue-400/20", text: "text-blue-300" },
  awaiting_feedback: { label: "Question", bg: "bg-violet-400/20", text: "text-violet-300", glow: true },
  ready_for_dev: { label: "Ready", bg: "bg-emerald-400/20", text: "text-emerald-300" },
  dev_complete: { label: "Dev Complete", bg: "bg-purple-400/20", text: "text-purple-300" },
  error: { label: "Error", bg: "bg-red-400/20", text: "text-red-300" },
  complete: { label: "Complete", bg: "bg-emerald-400/20", text: "text-emerald-300" },
  merged: { label: "Merged", bg: "bg-emerald-400/20", text: "text-emerald-300" },
  queued: { label: "Queued", bg: "bg-yellow-400/20", text: "text-yellow-300" },
  reverted: { label: "Reverted", bg: "bg-orange-400/20", text: "text-orange-300" },
  awaiting_agent: { label: "Waiting for Agent", bg: "bg-amber-400/20", text: "text-amber-300" },
};

const typeBadge: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  feature: { label: "Feature", bg: "bg-amber-500/25", text: "text-amber-300" },
  fix: { label: "Fix", bg: "bg-rose-500/25", text: "text-rose-300" },
};

function TestBadge({ status, results }: { status: string; results: TestResults }) {
  const allPassed = results.failed === 0 && results.passed > 0;
  const hasFailed = results.failed > 0;

  return (
    <div className="mt-2.5 flex items-center gap-2">
      <FlaskConical className={`h-3 w-3 shrink-0 ${hasFailed ? "text-red-400/70" : allPassed ? "text-emerald-400/70" : "text-white/30"}`} />
      {results.total > 0 && (
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.round((results.passed / results.total) * 100)}%`,
              background: allPassed
                ? "rgb(52, 211, 153)"
                : hasFailed
                ? "rgb(248, 113, 113)"
                : "rgb(148, 163, 184)",
            }}
          />
        </div>
      )}
      <span className={`text-[11px] ${hasFailed ? "text-red-400/70" : allPassed ? "text-emerald-400/70" : "text-white/30"}`}>
        {hasFailed
          ? `${results.failed} fail`
          : `${results.passed}/${results.total}`}
      </span>
    </div>
  );
}

interface KanbanCardProps {
  card: Card;
  index: number;
  onClick: () => void;
  viewers?: PresenceUser[];
  lock?: CardLock;
}

export function KanbanCard({ card, index, onClick, viewers, lock }: KanbanCardProps) {
  const [fileDragOver, setFileDragOver] = useState(false);
  const badge = typeBadge[card.type] || typeBadge.feature;
  const status = statusBadge[card.agentStatus] || statusBadge.idle;
  const isRunning = card.agentStatus === "running";
  const needsAttention = card.agentStatus === "awaiting_feedback";
  const isReadyForDev = card.agentStatus === "ready_for_dev";
  const isDevComplete = card.agentStatus === "dev_complete";
  const isLocked = !!lock;

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
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              e.stopPropagation();
              setFileDragOver(true);
            }
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
              setFileDragOver(false);
            }
          }}
          onDrop={async (e) => {
            const droppedFiles = Array.from(e.dataTransfer.files);
            if (droppedFiles.length === 0) return;
            e.preventDefault();
            e.stopPropagation();
            setFileDragOver(false);
            const formData = new FormData();
            droppedFiles.forEach((f) => formData.append("files", f));
            await fetch(`/api/cards/${card.id}/files`, {
              method: "POST",
              body: formData,
            });
          }}
          className={`glass-card rounded-xl p-4 transition-all duration-200 ${
            isLocked
              ? "opacity-60 cursor-not-allowed ring-1 ring-yellow-400/40"
              : card.isIcebox
              ? "opacity-75 cursor-pointer"
              : "cursor-pointer"
          } ${
            fileDragOver
              ? "ring-2 ring-violet-400/50 bg-violet-500/10"
              : snapshot.isDragging
              ? "shadow-2xl shadow-black/30 ring-1 ring-white/20 scale-[1.02]"
              : isRunning
              ? "border-loop"
              : needsAttention
              ? "question-glow"
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
            {card.isIcebox && (
              <span className="shrink-0 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold bg-cyan-500/20 text-cyan-300">
                <Snowflake className="h-3 w-3" />
              </span>
            )}
            <h3 className={`text-sm font-semibold leading-snug ${card.isIcebox ? "text-white/60" : "text-white/90"}`}>
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

          {/* Test status badge */}
          {card.testStatus && card.testResults && (
            <TestBadge status={card.testStatus} results={card.testResults} />
          )}

          {/* Lock indicator */}
          {isLocked && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-yellow-400/80">
              <Lock className="h-3 w-3" />
              <span>{lock.userName} is moving this card</span>
            </div>
          )}

          {/* Bottom row: status + presence + branch/date */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {viewers && viewers.length > 0 && (
                <CardPresenceAvatars viewers={viewers} />
              )}
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
                      <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-violet-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
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
