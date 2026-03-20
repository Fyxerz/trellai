"use client";
import { useState } from "react";
import { Plus, Users, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateTeamDialog } from "./CreateTeamDialog";
import type { Team } from "@/types";

interface TeamSwitcherProps {
  teams: Team[];
  onCreateTeam: (name: string) => Promise<unknown>;
}

export function TeamSwitcher({ teams, onCreateTeam }: TeamSwitcherProps) {
  const [createOpen, setCreateOpen] = useState(false);

  const nonPersonalTeams = teams.filter((t) => !t.isPersonal);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-sm text-white/60 hover:text-white/80 hover:bg-white/8 transition-colors">
          <Users className="h-4 w-4" />
          Teams
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 glass border-white/10">
          {nonPersonalTeams.length === 0 ? (
            <div className="px-3 py-2 text-xs text-white/30">
              No teams yet
            </div>
          ) : (
            nonPersonalTeams.map((team) => (
              <DropdownMenuItem
                key={team.id}
                className="text-white/70 focus:text-white focus:bg-white/10"
                onClick={() => {
                  // Scroll to team section in dashboard
                  const el = document.getElementById(`team-${team.id}`);
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <Users className="h-3.5 w-3.5 mr-2 text-white/40" />
                {team.name}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-violet-400 focus:text-violet-300 focus:bg-violet-400/10"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-2" />
            Create Team
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateTeamDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={onCreateTeam}
      />
    </>
  );
}
