import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, cards, chatMessages, checklistItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
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

  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Check for running agents
  const projectCards = db
    .select()
    .from(cards)
    .where(eq(cards.projectId, id))
    .all();

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
    db.delete(checklistItems)
      .where(eq(checklistItems.cardId, card.id))
      .run();
    db.delete(chatMessages)
      .where(eq(chatMessages.cardId, card.id))
      .run();
    db.delete(cards).where(eq(cards.id, card.id)).run();
  }

  // Delete project-level chat messages
  db.delete(chatMessages)
    .where(eq(chatMessages.projectId, id))
    .run();

  // Delete project
  db.delete(projects).where(eq(projects.id, id)).run();

  return NextResponse.json({ success: true });
}
