"use client";
import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  DragDropContext,
  type DropResult,
  type DragStart,
} from "@hello-pangea/dnd";
import Link from "next/link";
import { Column } from "./Column";
import { CardDetail } from "./CardDetail";
import { ProjectChatWidget } from "@/components/chat/ProjectChatWidget";
import { UsageCounter } from "./UsageCounter";
import { PresenceBar } from "./PresenceBar";
import { AppHeader } from "@/components/layout/AppHeader";
import { FileUploadButton } from "@/components/files/FileUploadButton";
import { ProjectFilesPopover } from "@/components/files/ProjectFilesPopover";
import { useBoard } from "@/hooks/useBoard";
import { usePresence } from "@/hooks/usePresence";
import type { Card, Column as ColumnType, FileAttachment } from "@/types";
import { FileEditorDrawer } from "@/components/editor/FileEditorDrawer";
import { Loader2, ArrowLeft, FileEdit } from "lucide-react";

const COLUMNS: ColumnType[] = ["features", "planning", "production", "review", "complete"];

interface BoardProps {
  projectId: string;
}

function BoardInner({ projectId }: BoardProps) {
  const board = useBoard(projectId);
  const presence = usePresence({ projectId });
  const searchParams = useSearchParams();
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const lastCardRef = useRef<Card | null>(null);
  const deepLinked = useRef(false);
  const [projectFiles, setProjectFiles] = useState<FileAttachment[]>([]);
  const [uploadingProjectFiles, setUploadingProjectFiles] = useState(false);
  const [boardDragOver, setBoardDragOver] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const fetchProjectFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/files`);
      if (res.ok) setProjectFiles(await res.json());
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    if (!board.loading) fetchProjectFiles();
  }, [board.loading, fetchProjectFiles]);

  const handleProjectFileUpload = async (fileList: FileList | File[]) => {
    setUploadingProjectFiles(true);
    try {
      const formData = new FormData();
      Array.from(fileList).forEach((f) => formData.append("files", f));
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) await fetchProjectFiles();
    } finally {
      setUploadingProjectFiles(false);
    }
  };

  const handleDeleteProjectFile = async (fileId: string) => {
    await fetch(`/api/projects/${projectId}/files?fileId=${fileId}`, { method: "DELETE" });
    await fetchProjectFiles();
  };

  // Derive up-to-date card from board.cards, falling back to cached version during re-fetches
  const freshCard = selectedCard
    ? board.cards.find((c) => c.id === selectedCard.id) ?? null
    : null;
  if (freshCard) {
    lastCardRef.current = freshCard;
  } else if (!selectedCard) {
    lastCardRef.current = null;
  }
  const displayCard = freshCard ?? lastCardRef.current;

  // Deep-link: auto-open card from ?card= query param
  useEffect(() => {
    if (deepLinked.current || board.loading || board.cards.length === 0) return;
    const cardId = searchParams.get("card");
    if (cardId) {
      const card = board.cards.find((c) => c.id === cardId);
      if (card) {
        setSelectedCard(card);
      }
      deepLinked.current = true;
    }
  }, [searchParams, board.cards, board.loading]);

  const handleDragStart = (start: { draggableId: string }) => {
    presence.lockCard(start.draggableId);
  };

  const handleDragEnd = (result: DropResult) => {
    // Always unlock the card after drag ends
    presence.unlockCard(result.draggableId);

    if (!result.destination) return;
    const { draggableId, destination } = result;

    // Don't allow moving cards locked by another user
    if (presence.isLockedByOther(draggableId)) return;

    board.moveCard(
      draggableId,
      destination.droppableId as ColumnType,
      destination.index
    );
  };

  if (board.loading) {
    return (
      <div className="flex h-screen flex-col">
        <AppHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/" },
            { label: "Loading..." },
          ]}
        />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/30" />
        </div>
      </div>
    );
  }

  if (board.error || !board.project) {
    return (
      <div className="flex h-screen flex-col">
        <AppHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/" },
            { label: "Not Found" },
          ]}
        />
        <div className="flex flex-1 items-center justify-center">
          <div className="glass w-full max-w-md space-y-4 rounded-2xl p-8 text-center">
            <h2 className="text-xl font-bold text-white">Project Not Found</h2>
            <p className="text-sm text-white/50">
              {board.error || "This project doesn't exist or has been deleted."}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/15 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-screen flex-col overflow-hidden relative transition-colors ${boardDragOver ? "ring-2 ring-inset ring-violet-400/30" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setBoardDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
          setBoardDragOver(false);
        }
      }}
      onDrop={async (e) => {
        // Only handle if not caught by a card
        if (e.defaultPrevented) return;
        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length === 0) return;
        e.preventDefault();
        setBoardDragOver(false);
        await handleProjectFileUpload(droppedFiles);
      }}
    >
      {/* Header */}
      <AppHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: board.project.name },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg bg-white/5 p-0.5">
              <button
                onClick={() => board.toggleMode("worktree")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  board.project?.mode !== "queue"
                    ? "bg-white/10 text-white/90"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                Worktree
              </button>
              <button
                onClick={() => board.toggleMode("queue")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  board.project?.mode === "queue"
                    ? "bg-white/10 text-white/90"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                Queue
              </button>
            </div>
            <button
              onClick={() => setEditorOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
              title="Open file editor"
            >
              <FileEdit className="h-3.5 w-3.5" />
              Editor
            </button>
            <ProjectFilesPopover
              files={projectFiles}
              onUpload={handleProjectFileUpload}
              onDelete={handleDeleteProjectFile}
              uploading={uploadingProjectFiles}
            />
            <UsageCounter />
            <PresenceBar users={presence.users} currentUser={presence.currentUser} />
          </div>
        }
      />

      {/* Board title area */}
      <div className="relative z-10 px-8 pb-4">
        <EditableTitle
          value={board.project.name}
          onSave={(name) => board.renameProject(board.project!.id, name)}
        />
        <p className="mt-0.5 text-sm text-white/40">
          {board.cards.length} card{board.cards.length !== 1 ? "s" : ""} across{" "}
          {COLUMNS.length} columns
        </p>
      </div>

      {/* Columns */}
      <div className="relative z-10 flex-1 min-h-0 px-8 pb-8">
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-5 h-full items-start">
            {COLUMNS.map((col) => (
              <Column
                key={col}
                column={col}
                cards={board.getColumnCards(col)}
                onCardClick={(card) => {
                  presence.viewCard(card.id);
                  setSelectedCard(card);
                }}
                onCreateCard={board.createCard}
                cardViewers={presence.cardViewers}
                cardLocks={presence.cardLocks}
              />
            ))}
          </div>
        </DragDropContext>
      </div>

      {displayCard && selectedCard && (
        <CardDetail
          card={displayCard}
          open={!!displayCard}
          onClose={() => {
            if (selectedCard) presence.unviewCard(selectedCard.id);
            lastCardRef.current = null;
            setSelectedCard(null);
          }}
          onUpdate={async (updates) => {
            const updated = await board.updateCard(selectedCard.id, updates);
            setSelectedCard(updated);
          }}
          onDelete={async () => {
            await board.deleteCard(selectedCard.id);
            lastCardRef.current = null;
            setSelectedCard(null);
          }}
          onRefresh={board.refreshCards}
        />
      )}

      {board.project && (
        <ProjectChatWidget
          projectId={board.project.id}
          projectName={board.project.name}
          onCardCreated={board.refreshCards}
        />
      )}

      <FileEditorDrawer
        projectId={projectId}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  );
}

export function Board({ projectId }: BoardProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/30" />
        </div>
      }
    >
      <BoardInner projectId={projectId} />
    </Suspense>
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
