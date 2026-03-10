"use client";
import { useState } from "react";
import { Check, X, Play, Square } from "lucide-react";

interface DiffViewerProps {
  diff: string;
  cardId: string;
  commitSha?: string | null;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}

export function DiffViewer({ diff, cardId, commitSha, onApprove, onReject }: DiffViewerProps) {
  const [previewPort, setPreviewPort] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const startPreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/cards/${cardId}/preview`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.port) {
        setPreviewPort(data.port);
        window.open(data.url, "_blank");
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const stopPreview = async () => {
    await fetch(`/api/cards/${cardId}/preview`, { method: "DELETE" });
    setPreviewPort(null);
  };
  if (!diff) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/30">
        No changes to review.
      </div>
    );
  }

  const lines = diff.split("\n");

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto mx-4 mt-2 mb-3 rounded-xl bg-black/20 border border-white/8">
        <pre className="p-4 text-xs font-mono leading-relaxed">
          {lines.map((line, i) => {
            let className = "text-white/40";
            if (line.startsWith("+") && !line.startsWith("+++")) {
              className = "bg-emerald-500/8 text-emerald-300/80";
            } else if (line.startsWith("-") && !line.startsWith("---")) {
              className = "bg-red-500/8 text-red-300/80";
            } else if (line.startsWith("@@")) {
              className = "text-blue-400/60";
            } else if (line.startsWith("diff ") || line.startsWith("index ")) {
              className = "text-white/20 font-bold";
            }
            return (
              <div key={i} className={`px-2 -mx-2 ${className}`}>
                {line}
              </div>
            );
          })}
        </pre>
      </div>

      <div className="flex justify-between gap-2 px-4 pb-4 shrink-0">
        <div>
          {previewPort ? (
            <button
              onClick={stopPreview}
              className="flex items-center gap-1.5 rounded-xl border border-orange-500/30 px-4 py-2 text-sm font-medium text-orange-300 hover:bg-orange-500/10 transition-colors"
            >
              <Square className="h-3.5 w-3.5" />
              Stop Preview (:{previewPort})
            </button>
          ) : (
            <button
              onClick={startPreview}
              disabled={previewLoading}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white/80 transition-colors disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5" />
              {previewLoading ? "Starting..." : "Preview"}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => { await stopPreview(); await onReject(); }}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white/80 transition-colors"
          >
            <X className="h-4 w-4" />
            Reject & Rework
          </button>
          <button
            onClick={async () => { await stopPreview(); await onApprove(); }}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 transition-shadow"
          >
            <Check className="h-4 w-4" />
            {commitSha ? "Approve" : "Approve & Merge"}
          </button>
        </div>
      </div>
    </div>
  );
}
