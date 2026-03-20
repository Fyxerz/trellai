"use client";
import { useState } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { ChevronRight } from "lucide-react";
import { KanbanCard } from "./KanbanCard";
import type { Card, PresenceUser, CardLock } from "@/types";

interface CardGroupProps {
  label: string;
  cards: Card[];
  defaultExpanded: boolean;
  droppableId: string;
  indexOffset: number;
  onCardClick: (card: Card) => void;
  cardViewers?: Record<string, PresenceUser[]>;
  cardLocks?: Record<string, CardLock>;
}

export function CardGroup({
  label,
  cards,
  defaultExpanded,
  droppableId,
  indexOffset,
  onCardClick,
  cardViewers,
  cardLocks,
}: CardGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (cards.length === 0) return null;

  return (
    <div className="space-y-1">
      {/* Group header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors"
      >
        <ChevronRight
          className={`h-3 w-3 shrink-0 transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          }`}
        />
        <span>{label}</span>
        <span className="ml-auto text-[11px] font-normal text-white/30">
          {cards.length}
        </span>
      </button>

      {/* Collapsed summary */}
      {!expanded && (
        <div className="ml-5 flex flex-wrap gap-1 px-1 pb-1">
          {cards.slice(0, 5).map((card) => (
            <button
              key={card.id}
              onClick={() => onCardClick(card)}
              className="glass-card rounded-lg px-2.5 py-1 text-[11px] text-white/50 hover:text-white/70 transition-colors truncate max-w-[200px]"
              title={card.title}
            >
              {card.title}
            </button>
          ))}
          {cards.length > 5 && (
            <span className="rounded-lg px-2 py-1 text-[11px] text-white/30">
              +{cards.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Expanded cards */}
      {expanded && (
        <Droppable droppableId={droppableId}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`space-y-3 ml-2 pl-2 border-l border-white/10 transition-all duration-200 ${
                snapshot.isDraggingOver ? "bg-white/5 rounded-xl" : ""
              }`}
            >
              {cards.map((card, i) => (
                <KanbanCard
                  key={card.id}
                  card={card}
                  index={indexOffset + i}
                  onClick={() => onCardClick(card)}
                  viewers={cardViewers?.[card.id]}
                  lock={cardLocks?.[card.id]}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      )}
    </div>
  );
}
