"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddCardDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string, description: string) => void;
}

export function AddCardDialog({ open, onClose, onAdd }: AddCardDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), description.trim());
    setTitle("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass border-white/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">New Card</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white/60">Title</label>
            <input
              className="mt-1.5 w-full rounded-xl bg-white/8 px-4 py-2.5 text-sm text-white placeholder:text-white/25 border border-white/10 focus:border-white/25 focus:outline-none transition-colors"
              placeholder="Feature title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white/60">
              Description
            </label>
            <textarea
              className="mt-1.5 w-full rounded-xl bg-white/8 px-4 py-2.5 text-sm text-white placeholder:text-white/25 border border-white/10 focus:border-white/25 focus:outline-none transition-colors resize-none"
              placeholder="Describe what this feature should do..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-white/50 hover:text-white/80 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/35 transition-shadow disabled:opacity-40 disabled:shadow-none"
            >
              Add Card
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
