import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { orchestrator } from "@/lib/agents/orchestrator";
import { stopPreviewServer } from "../preview/route";
import type { Column } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { column, position } = body as {
    column: Column;
    position: number;
  };

  const card = db.select().from(cards).where(eq(cards.id, id)).get();
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const previousColumn = card.column as Column;
  const now = new Date().toISOString();

  // Check if project is in queue mode
  const project = db.select().from(projects).where(eq(projects.id, card.projectId)).get();
  const isQueueMode = project?.mode === "queue";

  // Queue mode complete transition doesn't need merge — work is already on main
  const isCompleteTransition = column === "complete" && previousColumn === "review" && !isQueueMode;

  // Update DB for all transitions EXCEPT review→complete in worktree mode (which needs merge first)
  if (!isCompleteTransition) {
    db.update(cards)
      .set({ column, position, updatedAt: now })
      .where(eq(cards.id, id))
      .run();
  }

  // Stop preview server when leaving review
  if (previousColumn === "review" && column !== "review") {
    stopPreviewServer(id);
  }

  // Handle column transition side effects
  try {
    if (column === "production" && previousColumn !== "production") {
      await orchestrator.onMoveToProduction(id);
    } else if (column === "review" && previousColumn === "production") {
      await orchestrator.onMoveToReview(id);
    } else if (isCompleteTransition) {
      await orchestrator.onMoveToComplete(id);
      // Merge succeeded — now update column
      db.update(cards)
        .set({ column, position, updatedAt: now })
        .where(eq(cards.id, id))
        .run();
    } else if (column === "features" && previousColumn !== "features") {
      await orchestrator.onMoveToFeatures(id);
    }
  } catch (error) {
    console.error("Orchestrator error:", error);
    if (isCompleteTransition) {
      // Orchestrator already rolled card back to "review" with error status
      const failedCard = db.select().from(cards).where(eq(cards.id, id)).get();
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Merge failed" },
        { status: 500 }
      );
    }
  }

  const updatedCard = db.select().from(cards).where(eq(cards.id, id)).get();
  return NextResponse.json(updatedCard);
}
