import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { orchestrator } from "@/lib/agents/orchestrator";
import { stopPreviewServer } from "../preview/route";
import type { Column } from "@/types";

const repos = getLocalRepositories();

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

  const card = repos.cards.findById(id);
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const previousColumn = card.column as Column;
  const now = new Date().toISOString();

  // Check if project is in queue mode
  const project = repos.projects.findById(card.projectId);
  const isQueueMode = project?.mode === "queue";

  // Queue mode complete transition doesn't need merge — work is already on main
  const isCompleteTransition = column === "complete" && previousColumn === "review" && !isQueueMode;

  // Update DB for all transitions EXCEPT review→complete in worktree mode (which needs merge first)
  if (!isCompleteTransition) {
    repos.cards.update(id, { column, position, updatedAt: now });
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
      repos.cards.update(id, { column, position, updatedAt: now });
    } else if (column === "features" && previousColumn !== "features") {
      await orchestrator.onMoveToFeatures(id);
    }
  } catch (error) {
    console.error("Orchestrator error:", error);
    if (isCompleteTransition) {
      // Orchestrator already rolled card back to "review" with error status
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Merge failed" },
        { status: 500 }
      );
    }
  }

  const updatedCard = repos.cards.findById(id);
  return NextResponse.json(updatedCard);
}
