"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, repoPath: string) => Promise<unknown>;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreate,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const [creating, setCreating] = useState(false);

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

  const handleCreate = async () => {
    if (!name || !repoPath) return;
    setCreating(true);
    try {
      await onCreate(name, repoPath);
      setName("");
      setRepoPath("");
      onOpenChange(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={creating ? () => {} : onOpenChange}>
      <DialogContent className="glass border-white/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">New Board</DialogTitle>
          <DialogDescription className="text-white/50">
            Create a new project board to track work.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium text-white/70">
              Project Name
            </label>
            <input
              className="mt-1.5 w-full rounded-xl bg-white/8 px-4 py-2.5 text-sm text-white placeholder:text-white/30 border border-white/10 focus:border-white/25 focus:outline-none transition-colors"
              placeholder="My Project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
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
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
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
            disabled={!name || !repoPath || creating}
            onClick={handleCreate}
          >
            {creating ? "Creating & analyzing repository..." : "Create Board"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
