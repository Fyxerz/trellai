import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { orchestrator } from "@/lib/agents/orchestrator";

const repos = getLocalRepositories();

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await orchestrator.revertCard(id);
    const updatedCard = await repos.cards.findById(id);
    return NextResponse.json(updatedCard);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Revert failed" },
      { status: 500 }
    );
  }
}
