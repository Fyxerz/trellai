import { NextResponse } from "next/server";
import { getLocalRepositories, getRepositories } from "@/lib/db/repositories";
import { getOptionalUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const repos = getLocalRepositories();

export async function GET() {
  const user = await getOptionalUser();

  const allProjects = await repos.projects.findAll();
  const allCards = await repos.cards.findAll();

  // Get team IDs the user belongs to (for team-based access)
  let userTeamIds = new Set<string>();
  if (user) {
    try {
      const supabase = await createServerSupabaseClient();
      const supaRepos = getRepositories("supabase", supabase);
      if (supaRepos.teamMembers) {
        const memberships = await supaRepos.teamMembers.findByUserId(user.id);
        userTeamIds = new Set(memberships.map((m) => m.teamId));
      }
    } catch {
      // Supabase may not be configured — fall back to local team repos
      try {
        if (repos.teamMembers) {
          const memberships = await repos.teamMembers.findByUserId(user.id);
          userTeamIds = new Set(memberships.map((m) => m.teamId));
        }
      } catch {
        // Team repos not available
      }
    }
  }

  // Filter projects:
  // - Authenticated: owned by user, legacy (null userId), or in user's teams
  // - Anonymous: only null userId projects
  const userProjects = user
    ? allProjects.filter(
        (p) =>
          p.userId === user.id ||
          p.userId === null ||
          (p.teamId && userTeamIds.has(p.teamId))
      )
    : allProjects.filter((p) => p.userId === null);

  const attentionStatuses = new Set(["awaiting_feedback", "dev_complete", "error"]);

  const summaries = userProjects.map((project) => {
    const projectCards = allCards.filter((c) => c.projectId === project.id);
    const counts = {
      features: projectCards.filter((c) => c.column === "features").length,
      production: projectCards.filter((c) => c.column === "production").length,
      review: projectCards.filter((c) => c.column === "review").length,
      complete: projectCards.filter((c) => c.column === "complete").length,
    };
    const attentionCards = projectCards.filter((c) =>
      attentionStatuses.has(c.agentStatus)
    );
    const totalCards = projectCards.length;

    return {
      project,
      counts,
      totalCards,
      attentionCards,
    };
  });

  return NextResponse.json(summaries);
}
