"use client";
import Link from "next/link";
import { AlertCircle, MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import type { Card } from "@/types";

interface AttentionCard extends Card {
  projectName: string;
  projectId: string;
}

interface AttentionFeedProps {
  cards: AttentionCard[];
}

const statusConfig: Record<
  string,
  { icon: typeof AlertCircle; color: string; bg: string; label: string }
> = {
  awaiting_feedback: {
    icon: MessageSquare,
    color: "text-amber-300",
    bg: "bg-amber-400/15",
    label: "Needs Input",
  },
  dev_complete: {
    icon: CheckCircle2,
    color: "text-purple-300",
    bg: "bg-purple-400/15",
    label: "Dev Complete",
  },
  error: {
    icon: XCircle,
    color: "text-red-300",
    bg: "bg-red-400/15",
    label: "Error",
  },
};

export function AttentionFeed({ cards }: AttentionFeedProps) {
  if (cards.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-white/80">
          Needs Attention
        </h3>
        <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-medium text-amber-300">
          {cards.length}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {cards.map((card) => {
          const config = statusConfig[card.agentStatus] || statusConfig.error;
          const Icon = config.icon;
          return (
            <Link
              key={card.id}
              href={`/board/${card.projectId}?card=${card.id}`}
              className="shrink-0"
            >
              <div
                className={`glass-card rounded-xl px-4 py-3 w-64 transition-all hover:scale-[1.02] hover:shadow-md ${config.bg} border-transparent`}
              >
                <div className="flex items-start gap-2">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white/90 truncate">
                      {card.title}
                    </p>
                    <p className="mt-0.5 text-xs text-white/40 truncate">
                      {card.projectName}
                    </p>
                    <span
                      className={`mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ${config.bg} ${config.color}`}
                    >
                      {config.label}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
