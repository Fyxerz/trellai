"use client";
import { useState, useRef, useEffect } from "react";
import {
  DragDropContext,
  type DropResult,
} from "@hello-pangea/dnd";
import { Column } from "./Column";
import { CardDetail } from "./CardDetail";
import { ProjectChatWidget } from "@/components/chat/ProjectChatWidget";
import { UsageCounter } from "./UsageCounter";
import { useBoard } from "@/hooks/useBoard";
import type { Card, Column as ColumnType } from "@/types";

const COLUMNS: ColumnType[] = ["features", "production", "review", "complete"];

export function Board() {
  const board = useBoard();
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    board.moveCard(
      draggableId,
      destination.droppableId as ColumnType,
      destination.index
    );
  };

  if (!board.activeProject) {
    return <ProjectSetup onCreate={board.createProject} />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden relative">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold tracking-tight text-white/90">Trellai</h1>
          <nav className="flex items-center gap-4">
            <span className="text-sm font-medium text-white/50">Home</span>
            <span className="border-b-2 border-white/80 pb-0.5 text-sm font-medium text-white/90">
              Boards
            </span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-white/5 p-0.5">
            <button
              onClick={() => board.toggleMode("worktree")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                board.activeProject?.mode !== "queue"
                  ? "bg-white/10 text-white/90"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Worktree
            </button>
            <button
              onClick={() => board.toggleMode("queue")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                board.activeProject?.mode === "queue"
                  ? "bg-white/10 text-white/90"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Queue
            </button>
          </div>
          <UsageCounter />
          {board.projects.length > 1 && (
            <select
              className="rounded-lg glass px-3 py-1.5 text-sm text-white/80"
              value={board.activeProject.id}
              onChange={(e) => {
                const p = board.projects.find((p) => p.id === e.target.value);
                if (p) board.setActiveProject(p);
              }}
            >
              {board.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 ring-2 ring-white/20" />
        </div>
      </header>

      {/* Board title area */}
      <div className="relative z-10 px-8 pb-4">
        <EditableTitle
          value={board.activeProject.name}
          onSave={(name) => board.renameProject(board.activeProject!.id, name)}
        />
        <p className="mt-0.5 text-sm text-white/40">
          {board.cards.length} card{board.cards.length !== 1 ? "s" : ""} across{" "}
          {COLUMNS.length} columns
        </p>
      </div>

      {/* Columns */}
      <div className="relative z-10 flex-1 min-h-0 px-8 pb-8">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-5 h-full items-start">
            {COLUMNS.map((col) => (
              <Column
                key={col}
                column={col}
                cards={board.getColumnCards(col)}
                onCardClick={setSelectedCard}
                onCreateCard={board.createCard}
              />
            ))}
          </div>
        </DragDropContext>
      </div>

      {selectedCard && (
        <CardDetail
          card={selectedCard}
          open={!!selectedCard}
          onClose={() => setSelectedCard(null)}
          onUpdate={async (updates) => {
            const updated = await board.updateCard(selectedCard.id, updates);
            setSelectedCard(updated);
          }}
          onDelete={async () => {
            await board.deleteCard(selectedCard.id);
            setSelectedCard(null);
          }}
          onRefresh={board.refreshCards}
        />
      )}

      {board.activeProject && (
        <ProjectChatWidget
          projectId={board.activeProject.id}
          projectName={board.activeProject.name}
          onCardCreated={board.refreshCards}
        />
      )}
    </div>
  );
}

function EditableTitle({
  value,
  onSave,
}: {
  value: string;
  onSave: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="text-3xl font-bold text-white bg-transparent border-b-2 border-white/30 focus:border-white/60 outline-none w-full"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <h2
      className="text-3xl font-bold text-white cursor-pointer hover:text-white/80 transition-colors"
      onClick={() => setEditing(true)}
      title="Click to rename"
    >
      {value}
    </h2>
  );
}

function ProjectSetup({
  onCreate,
}: {
  onCreate: (name: string, repoPath: string) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [browsing, setBrowsing] = useState(false);

  const handleBrowse = async () => {
    setBrowsing(true);
    try {
      const res = await fetch("/api/folder-picker", { method: "POST" });
      const data = await res.json();
      if (data.path) {
        setRepoPath(data.path);
      }
    } finally {
      setBrowsing(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="glass w-full max-w-md space-y-6 rounded-2xl p-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Trellai</h1>
          <p className="mt-1 text-sm text-white/50">
            Set up your first project to get started.
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white/70">
              Project Name
            </label>
            <input
              className="mt-1.5 w-full rounded-xl bg-white/8 px-4 py-2.5 text-sm text-white placeholder:text-white/30 border border-white/10 focus:border-white/25 focus:outline-none transition-colors"
              placeholder="My Project"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white/70">
              Repository Path
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                className="flex-1 rounded-xl bg-white/8 px-4 py-2.5 text-sm font-mono text-white placeholder:text-white/30 border border-white/10 focus:border-white/25 focus:outline-none transition-colors"
                placeholder="/Users/you/code/my-project"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
              />
              <button
                type="button"
                className="rounded-xl bg-white/8 px-3 py-2.5 text-sm text-white/70 border border-white/10 hover:bg-white/12 hover:text-white transition-colors disabled:opacity-40"
                onClick={handleBrowse}
                disabled={browsing}
              >
                {browsing ? "..." : "Browse"}
              </button>
            </div>
          </div>
          <button
            className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow disabled:opacity-40 disabled:shadow-none"
            disabled={!name || !repoPath}
            onClick={() => onCreate(name, repoPath)}
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}
