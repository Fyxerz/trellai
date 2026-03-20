import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { getOptionalUser, assertCardAccessForUser } from "@/lib/auth";
import { orchestrator } from "@/lib/agents/orchestrator";

const repos = getLocalRepositories();

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOptionalUser();
  const { id } = await params;

  const hasAccess = await assertCardAccessForUser(id, user);
  if (!hasAccess) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  try {
    await orchestrator.revertCard(id);
    const updatedCard = await repos.cards.findById(id);
    return NextResponse.json({
      ...updatedCard,
      testResults: updatedCard?.testResults ? JSON.parse(updatedCard.testResults) : null,
      isIcebox: !!updatedCard?.isIcebox,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Revert failed" },
      { status: 500 }
    );
  }
}
