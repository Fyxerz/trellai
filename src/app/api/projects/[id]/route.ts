import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";

const repos = getLocalRepositories();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await repos.projects.findById(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await repos.projects.findById(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Check for running agents
  const projectCards = await repos.cards.findByProjectId(id);

  const runningCards = projectCards.filter(
    (c) => c.agentStatus === "running" || c.agentStatus === "queued"
  );

  if (runningCards.length > 0) {
    return NextResponse.json(
      {
        error:
          "Stop all running agents before deleting this project. " +
          `${runningCards.length} card(s) still have active agents.`,
      },
      { status: 409 }
    );
  }

  // Delete all cards for this project (cascade handles checklist + chat via FK)
  for (const card of projectCards) {
    // Explicitly delete related records for safety
    await repos.checklistItems.deleteByCardId(card.id);
    await repos.chatMessages.deleteByCardId(card.id);
    await repos.cards.delete(card.id);
  }

  // Delete project-level chat messages
  await repos.chatMessages.deleteByProjectId(id);

  // Delete project
  await repos.projects.delete(id);

  return NextResponse.json({ success: true });
}
