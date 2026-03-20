"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight, Settings, Users, Plus } from "lucide-react";
import Link from "next/link";
import { ProjectCard } from "./ProjectCard";
import type { ProjectSummary } from "@/hooks/useDashboard";
import type { Team } from "@/types";

interface TeamSectionProps {
  team: Team;
  projects: ProjectSummary[];
  memberCount?: number;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onCreateProject: () => void;
}

export function TeamSection({
  team,
  projects,
  memberCount,
  onDelete,
  onRename,
  onCreateProject,
}: TeamSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-8">
      {/* Section Header */}
      <div className="mb-4 flex items-center justify-between">
        <button
          className="flex items-center gap-2 group"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-white/40 group-hover:text-white/60 transition-colors" />
          ) : (
            <ChevronDown className="h-4 w-4 text-white/40 group-hover:text-white/60 transition-colors" />
          )}
          <h2 className="text-lg font-bold text-white group-hover:text-white/90 transition-colors">
            {team.name}
          </h2>
          {memberCount !== undefined && !team.isPersonal && (
            <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/40">
              <Users className="h-3 w-3" />
              {memberCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-white/30">
            {projects.length} board{projects.length !== 1 ? "s" : ""}
          </span>
          {!team.isPersonal && (
            <Link
              href={`/teams/${team.id}/settings`}
              className="rounded-lg p-1.5 text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
              title="Team Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Project Grid */}
      {!collapsed && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((summary) => (
            <ProjectCard
              key={summary.project.id}
              summary={summary}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}

          {/* Add new board tile within this team */}
          <button
            onClick={onCreateProject}
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
      )}
    </div>
  );
}
