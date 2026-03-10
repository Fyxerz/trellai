"use client";
import { useState } from "react";
import { Plus, LayoutDashboard, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { ProjectCard } from "./ProjectCard";
import { AttentionFeed } from "./AttentionFeed";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { useDashboard } from "@/hooks/useDashboard";

export function Dashboard() {
  const dashboard = useDashboard();
  const [createOpen, setCreateOpen] = useState(false);

  if (dashboard.loading) {
    return (
      <div className="flex h-screen flex-col">
        <AppHeader breadcrumbs={[{ label: "Dashboard" }]} />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/30" />
        </div>
      </div>
    );
  }

  // Empty state — no projects at all
  if (dashboard.projects.length === 0) {
    return (
      <div className="flex h-screen flex-col">
        <AppHeader breadcrumbs={[{ label: "Dashboard" }]} />
        <div className="flex flex-1 items-center justify-center">
          <div className="glass w-full max-w-md space-y-6 rounded-2xl p-8 text-center">
            <div>
              <LayoutDashboard className="mx-auto h-12 w-12 text-white/20" />
              <h2 className="mt-4 text-2xl font-bold text-white">
                Welcome to Trellai
              </h2>
              <p className="mt-2 text-sm text-white/50">
                Create your first board to start orchestrating Claude Code
                agents across your projects.
              </p>
            </div>
            <button
              className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow"
              onClick={() => setCreateOpen(true)}
            >
              Create Your First Board
            </button>
          </div>
        </div>
        <CreateProjectDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreate={dashboard.createProject}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden relative">
      <AppHeader
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow"
            >
              <Plus className="h-4 w-4" />
              New Board
            </button>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 ring-2 ring-white/20" />
          </div>
        }
      />

      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {/* Attention Feed */}
        {dashboard.attentionCards.length > 0 && (
          <div className="mb-8">
            <AttentionFeed cards={dashboard.attentionCards} />
          </div>
        )}

        {/* Project Grid */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Your Boards</h2>
          <span className="text-sm text-white/40">
            {dashboard.projects.length} project
            {dashboard.projects.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {dashboard.projects.map((summary) => (
            <ProjectCard
              key={summary.project.id}
              summary={summary}
              onDelete={dashboard.deleteProject}
              onRename={dashboard.renameProject}
            />
          ))}

          {/* Add new board tile */}
          <button
            onClick={() => setCreateOpen(true)}
            className="glass-card rounded-2xl p-5 flex flex-col items-center justify-center gap-3 min-h-[180px] transition-all duration-200 hover:scale-[1.02] hover:bg-white/8 cursor-pointer border-dashed !border-white/10"
          >
            <div className="rounded-full bg-white/5 p-3">
              <Plus className="h-6 w-6 text-white/30" />
            </div>
            <span className="text-sm font-medium text-white/40">
              New Board
            </span>
          </button>
        </div>
      </div>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={dashboard.createProject}
      />
    </div>
  );
}
