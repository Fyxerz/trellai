"use client";
import { useState, useEffect, useRef } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import type { ChecklistItem } from "@/types";

interface ChecklistProps {
  cardId: string;
  onChange?: (items: ChecklistItem[]) => void;
  onChangeCount?: () => void;
}

export function Checklist({ cardId, onChange, onChangeCount }: ChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/cards/${cardId}/checklist`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        onChange?.(data);
      });
  }, [cardId]);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  const update = (newItems: ChecklistItem[], countChanged = false) => {
    setItems(newItems);
    onChange?.(newItems);
    if (countChanged) onChangeCount?.();
  };

  const addItem = async () => {
    const text = newText.trim();
    if (!text) {
      setAdding(false);
      setNewText("");
      return;
    }
    const res = await fetch(`/api/cards/${cardId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const item = await res.json();
    update([...items, item], true);
    setNewText("");
    inputRef.current?.focus();
  };

  const toggleItem = async (item: ChecklistItem) => {
    const checked = !item.checked;
    update(items.map((i) => (i.id === item.id ? { ...i, checked } : i)), true);
    await fetch(`/api/cards/${cardId}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, checked }),
    });
  };

  const saveEdit = async (item: ChecklistItem) => {
    const text = editText.trim();
    if (!text || text === item.text) {
      setEditingId(null);
      return;
    }
    update(items.map((i) => (i.id === item.id ? { ...i, text } : i)));
    setEditingId(null);
    await fetch(`/api/cards/${cardId}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, text }),
    });
  };

  const deleteItem = async (itemId: string) => {
    update(items.filter((i) => i.id !== itemId), true);
    await fetch(`/api/cards/${cardId}/checklist?itemId=${itemId}`, {
      method: "DELETE",
    });
  };

  const checked = items.filter((i) => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-white/40 uppercase tracking-wider">
          Checklist
        </label>
        {total > 0 && (
          <span className="text-xs text-white/30">
            {checked}/{total}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${pct}%`,
              background:
                pct === 100
                  ? "rgb(52, 211, 153)"
                  : "linear-gradient(to right, rgb(139, 92, 246), rgb(99, 102, 241))",
            }}
          />
        </div>
      )}

      {/* Items */}
      <div className="mt-3 space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-start gap-2 rounded-lg px-2 py-1.5 -mx-2 hover:bg-white/5 transition-colors"
          >
            <button
              onClick={() => toggleItem(item)}
              className={`shrink-0 mt-0.5 h-4 w-4 rounded border transition-colors flex items-center justify-center ${
                item.checked
                  ? "bg-violet-500 border-violet-500"
                  : "border-white/25 hover:border-white/50"
              }`}
            >
              {item.checked && (
                <svg
                  className="h-3 w-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>

            {editingId === item.id ? (
              <textarea
                ref={editRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => saveEdit(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(item); }
                  if (e.key === "Escape") setEditingId(null);
                }}
                rows={3}
                className="flex-1 bg-white/8 rounded px-2 py-0.5 text-sm leading-5 min-h-[3.75rem] text-white border border-white/15 focus:border-white/30 focus:outline-none resize-none"
              />
            ) : (
              <span
                onClick={() => {
                  setEditingId(item.id);
                  setEditText(item.text);
                }}
                className={`flex-1 text-sm leading-5 min-h-[3.75rem] cursor-pointer transition-colors ${
                  item.checked
                    ? "text-white/30 line-through"
                    : "text-white/70"
                }`}
              >
                {item.text}
              </span>
            )}

            <button
              onClick={() => deleteItem(item.id)}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add item */}
      {adding ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={inputRef}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addItem();
              if (e.key === "Escape") {
                setAdding(false);
                setNewText("");
              }
            }}
            placeholder="Add an item..."
            className="flex-1 bg-white/8 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/20 border border-white/10 focus:border-white/25 focus:outline-none transition-colors"
          />
          <button
            onClick={addItem}
            className="rounded-lg bg-violet-500/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
          >
            Add
          </button>
          <button
            onClick={() => {
              setAdding(false);
              setNewText("");
            }}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add item
        </button>
      )}
    </div>
  );
}
