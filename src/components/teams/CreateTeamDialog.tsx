"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<unknown>;
}

export function CreateTeamDialog({
  open,
  onOpenChange,
  onCreate,
}: CreateTeamDialogProps) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await onCreate(name.trim());
      setName("");
      onOpenChange(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={creating ? () => {} : onOpenChange}>
      <DialogContent className="glass border-white/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Create Team</DialogTitle>
          <DialogDescription className="text-white/50">
            Create a new team to collaborate with others on boards.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium text-white/70">
              Team Name
            </label>
            <input
              className="mt-1.5 w-full rounded-xl bg-white/8 px-4 py-2.5 text-sm text-white placeholder:text-white/30 border border-white/10 focus:border-white/25 focus:outline-none transition-colors"
              placeholder="My Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <button
            className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow disabled:opacity-40 disabled:shadow-none"
            disabled={!name.trim() || creating}
            onClick={handleCreate}
          >
            {creating ? "Creating..." : "Create Team"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
