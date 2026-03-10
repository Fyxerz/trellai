"use client";
import { useState, useRef, useEffect } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { KanbanCard } from "./KanbanCard";
import { Plus, MoreHorizontal } from "lucide-react";
import type { Card, CardType, Column as ColumnType } from "@/types";

const columnConfig: Record<
  ColumnType,
  { label: string; dotColor: string }
> = {
  features: { label: "Backlog", dotColor: "bg-amber-400" },
  production: { label: "In Development", dotColor: "bg-blue-400" },
  review: { label: "Review", dotColor: "bg-purple-400" },
  complete: { label: "Done", dotColor: "bg-emerald-400" },
};

interface ColumnProps {
  column: ColumnType;
  cards: Card[];
  onCardClick: (card: Card) => void;
  onCreateCard: (title: string, description?: string, type?: CardType) => Promise<Card | undefined>;
}

export function Column({ column, cards, onCardClick, onCreateCard }: ColumnProps) {
  const config = columnConfig[column];
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<CardType>("feature");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) {
      setIsAdding(false);
      setNewTitle("");
      setNewType("feature");
      return;
    }
    await onCreateCard(title, "", newType);
    setNewTitle("");
    // Keep adding mode open for rapid entry
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === "Escape") {
      setIsAdding(false);
      setNewTitle("");
    }
  };

  return (
    <div className="glass flex w-80 shrink-0 flex-col rounded-2xl max-h-full">
      {/* Column header */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
        <div className={`h-3 w-3 rounded-full ${config.dotColor}`} />
        <h2 className="text-base font-bold text-white">{config.label}</h2>
        <span className="ml-auto text-sm text-white/40">
          {cards.length} card{cards.length !== 1 ? "s" : ""}
        </span>
        <button className="ml-1 text-white/30 hover:text-white/60 transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Drop zone */}
      <Droppable droppableId={column}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`space-y-3 px-3 py-2 min-h-[60px] overflow-y-auto transition-all duration-200 ${
              snapshot.isDraggingOver
                ? "bg-white/5 rounded-xl mx-1"
                : ""
            }`}
          >
            {cards.map((card, index) => (
              <KanbanCard
                key={card.id}
                card={card}
                index={index}
                onClick={() => onCardClick(card)}
              />
            ))}
            {provided.placeholder}

            {/* Inline new card input */}
            {isAdding && (
              <div className="glass-card rounded-xl p-3 space-y-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setNewType("feature")}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                      newType === "feature"
                        ? "bg-amber-500/25 text-amber-300"
                        : "bg-white/5 text-white/30 hover:text-white/50"
                    }`}
                  >
                    Feature
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setNewType("fix")}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                      newType === "fix"
                        ? "bg-rose-500/25 text-rose-300"
                        : "bg-white/5 text-white/30 hover:text-white/50"
                    }`}
                  >
                    Fix
                  </button>
                </div>
                <textarea
                  ref={inputRef}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleAdd}
                  placeholder="Card title..."
                  rows={2}
                  className="w-full bg-transparent text-sm font-semibold text-white/90 placeholder:text-white/25 resize-none focus:outline-none"
                />
              </div>
            )}
          </div>
        )}
      </Droppable>

      {/* Add card footer */}
      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 px-4 py-3 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add a Card
        </button>
      )}
    </div>
  );
}
