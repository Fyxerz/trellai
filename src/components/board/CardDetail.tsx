"use client";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { DiffViewer } from "@/components/review/DiffViewer";
import { Trash2, GitBranch, Code2, MessageSquare, Copy, Check, Undo2 } from "lucide-react";
import { Checklist } from "./Checklist";
import { FileUploadButton } from "@/components/files/FileUploadButton";
import { FileList } from "@/components/files/FileList";
import { useFiles } from "@/hooks/useFiles";
import type { Card, CardType, ChecklistItem } from "@/types";

const statusBadge: Record<string, { label: string; class: string }> = {
  idle: { label: "Idle", class: "bg-white/10 text-white/50" },
  running: { label: "Running", class: "bg-blue-500/20 text-blue-300" },
  awaiting_feedback: { label: "Question", class: "bg-violet-500/20 text-violet-300" },
  ready_for_dev: { label: "Ready for Dev", class: "bg-emerald-500/20 text-emerald-300" },
  dev_complete: { label: "Dev Complete", class: "bg-purple-500/20 text-purple-300" },
  error: { label: "Error", class: "bg-red-500/20 text-red-300" },
  complete: { label: "Complete", class: "bg-emerald-500/20 text-emerald-300" },
  merged: { label: "Merged", class: "bg-emerald-500/20 text-emerald-300" },
  queued: { label: "Queued", class: "bg-yellow-500/20 text-yellow-300" },
  reverted: { label: "Reverted", class: "bg-orange-500/20 text-orange-300" },
};

const typeBadgeConfig: Record<string, { label: string; class: string }> = {
  feature: { label: "Feature", class: "bg-amber-500/20 text-amber-300" },
  fix: { label: "Fix", class: "bg-rose-500/20 text-rose-300" },
};

const columnLabel: Record<string, { label: string; class: string }> = {
  features: { label: "Backlog", class: "bg-amber-500/20 text-amber-300" },
  planning: { label: "Planning", class: "bg-cyan-500/20 text-cyan-300" },
  production: { label: "In Development", class: "bg-blue-500/20 text-blue-300" },
  review: { label: "Review", class: "bg-purple-500/20 text-purple-300" },
  complete: { label: "Done", class: "bg-emerald-500/20 text-emerald-300" },
};

interface CardDetailProps {
  card: Card;
  open: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<Card>) => Promise<void>;
  onDelete: () => Promise<void>;
  onRefresh: () => void;
}

export function CardDetail({
  card,
  open,
  onClose,
  onUpdate,
  onDelete,
  onRefresh,
}: CardDetailProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [diff, setDiff] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"chat" | "diff">(
    card.column === "review" ? "diff" : "chat"
  );
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const {
    cardFiles,
    projectFiles,
    uploading,
    uploadCardFiles,
    deleteFile,
  } = useFiles({ projectId: card.projectId, cardId: card.id });

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description);
    setActiveTab(card.column === "review" ? "diff" : "chat");
  }, [card]);

  useEffect(() => {
    if (card.column === "review" && (card.branchName || card.commitSha)) {
      fetch(`/api/cards/${card.id}/diff`)
        .then((r) => r.json())
        .then((d) => setDiff(d.diff))
        .catch(() => setDiff(""));
    }
  }, [card.id, card.column, card.branchName, card.commitSha]);

  const saveTitle = async () => {
    if (title.trim() && title !== card.title) {
      await onUpdate({ title: title.trim() });
    }
    setEditingTitle(false);
  };

  const saveDescription = async () => {
    if (description !== card.description) {
      await onUpdate({ description });
    }
  };

  const copyCard = async () => {
    const colName = columnLabel[card.column]?.label || card.column;
    const statusName = statusBadge[card.agentStatus]?.label || card.agentStatus;

    const lines: string[] = [];
    lines.push(`# ${card.title}`);
    lines.push("");
    const typeName = (typeBadgeConfig[card.type] || typeBadgeConfig.feature).label;
    lines.push(`**Type:** ${typeName}  |  **Status:** ${statusName}  |  **Column:** ${colName}`);
    if (card.branchName) lines.push(`**Branch:** ${card.branchName}`);
    if (card.description) {
      lines.push("");
      lines.push("## Description");
      lines.push(card.description);
    }

    // Fetch checklist items
    try {
      const res = await fetch(`/api/cards/${card.id}/checklist`);
      const items: ChecklistItem[] = await res.json();
      if (items.length > 0) {
        lines.push("");
        lines.push("## Checklist");
        items.forEach((item) => {
          lines.push(`- [${item.checked ? "x" : " "}] ${item.text}`);
        });
      }
    } catch {}

    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const status = statusBadge[card.agentStatus] || statusBadge.idle;
  const colLabel = columnLabel[card.column] || columnLabel.features;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={`glass border-white/10 sm:max-w-6xl h-[80vh] !flex flex-col gap-0 p-0 overflow-hidden transition-colors ${dragOver ? "ring-2 ring-violet-400/50" : ""}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOver(false);
          }
        }}
        onDrop={async (e) => {
          e.preventDefault();
          setDragOver(false);
          const droppedFiles = Array.from(e.dataTransfer.files);
          if (droppedFiles.length > 0) {
            await uploadCardFiles(droppedFiles);
          }
        }}
      >
        {/* Header */}
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-white/8">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {editingTitle ? (
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => e.key === "Enter" && saveTitle()}
                  autoFocus
                  className="w-full bg-white/8 rounded-lg px-3 py-1.5 text-lg font-bold text-white border border-white/15 focus:border-white/30 focus:outline-none"
                />
              ) : (
                <DialogTitle
                  className="cursor-pointer text-lg font-bold text-white hover:text-white/80 transition-colors truncate"
                  onClick={() => setEditingTitle(true)}
                >
                  {card.title}
                </DialogTitle>
              )}
              {card.branchName && (
                <div className="flex items-center gap-1.5 text-xs text-white/30 mt-1.5">
                  <GitBranch className="h-3 w-3" />
                  <span className="font-mono truncate">{card.branchName}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  const current = card.type || "feature";
                  const next: CardType = current === "feature" ? "fix" : "feature";
                  onUpdate({ type: next });
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${(typeBadgeConfig[card.type] || typeBadgeConfig.feature).class}`}
                title="Click to toggle type"
              >
                {(typeBadgeConfig[card.type] || typeBadgeConfig.feature).label}
              </button>
              <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${status.class}`}>
                {status.label}
              </span>
              <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${colLabel.class}`}>
                {colLabel.label}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Content area — two columns */}
        <div className="flex-1 flex min-h-0">
          {/* Left column: description + checklist */}
          <div className="w-2/5 overflow-y-auto border-r border-white/8 px-6 py-4 space-y-4">
            {(card.column === "features" || card.column === "planning") && (
              <div>
                <label className="text-xs font-medium text-white/40 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  className="mt-2 w-full rounded-xl bg-white/6 px-4 py-3 text-sm text-white/80 placeholder:text-white/20 border border-white/8 focus:border-white/20 focus:outline-none transition-colors resize-none"
                  placeholder="Describe this feature..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={saveDescription}
                  rows={3}
                />
              </div>
            )}
            <Checklist cardId={card.id} onChangeCount={onRefresh} />

            {/* Files section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-white/40 uppercase tracking-wider">
                  Files
                </label>
                <FileUploadButton onUpload={uploadCardFiles} uploading={uploading} />
              </div>
              <FileList
                cardFiles={cardFiles}
                projectFiles={projectFiles}
                onDeleteCardFile={(fileId) => deleteFile(fileId, "card")}
              />
            </div>
          </div>

          {/* Right column: tabs + chat/diff */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* Tabs for review */}
            {card.column === "review" && (
              <div className="shrink-0 flex gap-1 px-6 pt-3 pb-1">
                <button
                  onClick={() => setActiveTab("diff")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "diff"
                      ? "bg-white/10 text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  Diff
                </button>
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "chat"
                      ? "bg-white/10 text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Chat
                </button>
              </div>
            )}

            {/* Main content */}
            <div className="flex-1 min-h-0">
              {activeTab === "chat" ? (
                <ChatPanel cardId={card.id} column={card.column} cardTitle={card.title} cardDescription={card.description} onAutoMove={() => { onRefresh(); onClose(); }} />
              ) : (
                <DiffViewer
                  diff={diff}
                  cardId={card.id}
                  commitSha={card.commitSha}
                  onApprove={async () => {
                    const res = await fetch(`/api/cards/${card.id}/move`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ column: "complete", position: 0 }),
                    });
                    if (!res.ok) {
                      const data = await res.json();
                      alert(`Merge failed: ${data.error || "Unknown error"}`);
                      onRefresh();
                      return;
                    }
                    onRefresh();
                    onClose();
                  }}
                  onReject={async () => {
                    await fetch(`/api/cards/${card.id}/move`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ column: "production", position: 0 }),
                    });
                    onRefresh();
                    onClose();
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex justify-between items-center px-6 py-3 border-t border-white/8">
          <div className="flex items-center gap-2">
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
            <button
              onClick={copyCard}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
            {card.commitSha && (card.column === "review" || card.column === "complete") && (
              <button
                onClick={async () => {
                  if (!confirm("Revert this commit? This will create a new revert commit on main.")) return;
                  const res = await fetch(`/api/cards/${card.id}/revert`, { method: "POST" });
                  if (!res.ok) {
                    const data = await res.json();
                    alert(`Revert failed: ${data.error || "Unknown error"}`);
                  }
                  onRefresh();
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-orange-400/70 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Revert
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
