"use client";
import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Trash2, FolderGit2, AlertCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectSummary } from "@/hooks/useDashboard";

interface ProjectCardProps {
  summary: ProjectSummary;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
}

const columnColors = {
  features: "bg-amber-400",
  production: "bg-blue-400",
  review: "bg-purple-400",
  complete: "bg-emerald-400",
};

export function ProjectCard({ summary, onDelete, onRename }: ProjectCardProps) {
  const { project, counts, totalCards, attentionCards } = summary;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await onDelete(project.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleRename = async () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== project.name) {
      await onRename(project.id, trimmed);
    } else {
      setDraft(project.name);
    }
    setEditing(false);
  };

  // Calculate bar segments
  const barTotal = Math.max(totalCards, 1);

  return (
    <Link href={`/board/${project.id}`} className="block group">
      <div className="glass-card rounded-2xl p-5 transition-all duration-200 group-hover:scale-[1.02] group-hover:shadow-lg group-hover:shadow-black/20 relative">
        {/* Attention indicator */}
        {attentionCards.length > 0 && (
          <span className="absolute top-4 right-12 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
          </span>
        )}

        {/* Menu */}
        <div className="absolute top-3 right-3" onClick={(e) => e.preventDefault()}>
          <DropdownMenu onOpenChange={() => setConfirmDelete(false)}>
            <DropdownMenuTrigger className="rounded-lg p-1.5 text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass border-white/10">
              <DropdownMenuItem
                className="text-white/70 focus:text-white focus:bg-white/10"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditing(true);
                }}
              >
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`focus:bg-white/10 ${
                  confirmDelete
                    ? "text-red-400 focus:text-red-300"
                    : "text-white/70 focus:text-white"
                }`}
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                {deleting
                  ? "Deleting..."
                  : confirmDelete
                  ? "Click again to confirm"
                  : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Project name */}
        {editing ? (
          <input
            className="text-lg font-bold text-white bg-transparent border-b border-white/30 focus:border-white/60 outline-none w-full pr-8"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") {
                setDraft(project.name);
                setEditing(false);
              }
            }}
            onClick={(e) => e.preventDefault()}
            autoFocus
          />
        ) : (
          <h3 className="text-lg font-bold text-white pr-8">{project.name}</h3>
        )}

        {/* Repo path */}
        <p className="mt-1 flex items-center gap-1.5 text-xs font-mono text-white/30 truncate">
          <FolderGit2 className="h-3 w-3 shrink-0" />
          {project.repoPath}
        </p>

        {/* Column breakdown bar */}
        {totalCards > 0 && (
          <div className="mt-4 flex h-2 rounded-full overflow-hidden bg-white/5">
            {(["features", "production", "review", "complete"] as const).map(
              (col) =>
                counts[col] > 0 && (
                  <div
                    key={col}
                    className={`${columnColors[col]} opacity-70 transition-all duration-300`}
                    style={{ width: `${(counts[col] / barTotal) * 100}%` }}
                  />
                )
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-4 text-xs text-white/40">
          <span>{totalCards} card{totalCards !== 1 ? "s" : ""}</span>
          {counts.production > 0 && (
            <span className="text-blue-300/70">
              {counts.production} in production
            </span>
          )}
          {counts.review > 0 && (
            <span className="text-purple-300/70">
              {counts.review} in review
            </span>
          )}
          {attentionCards.length > 0 && (
            <span className="flex items-center gap-1 text-amber-300/70">
              <AlertCircle className="h-3 w-3" />
              {attentionCards.length} need{attentionCards.length === 1 ? "s" : ""} attention
            </span>
          )}
        </div>

        {/* Mode + storage badges */}
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/30 uppercase tracking-wider">
            {project.mode}
          </span>
          {project.teamId ? (
            <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400/70 uppercase tracking-wider">
              Team
            </span>
          ) : (
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400/70 uppercase tracking-wider">
              Local
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
