import { NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";

const repos = getLocalRepositories();

export async function GET() {
  const allProjects = repos.projects.findAll();
  const allCards = repos.cards.findAll();

  const attentionStatuses = new Set(["awaiting_feedback", "dev_complete", "error"]);

  const summaries = allProjects.map((project) => {
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
