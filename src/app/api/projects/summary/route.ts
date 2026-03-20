import { NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { getAuthUser, unauthorized } from "@/lib/auth";

const repos = getLocalRepositories();

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const allProjects = await repos.projects.findAll();
  const allCards = await repos.cards.findAll();

  // Filter projects by ownership (legacy projects with null userId remain accessible)
  const userProjects = allProjects.filter(
    (p) => p.userId === user.id || p.userId === null
  );

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
