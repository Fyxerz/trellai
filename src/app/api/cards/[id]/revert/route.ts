import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { orchestrator } from "@/lib/agents/orchestrator";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await orchestrator.revertCard(id);
    const updatedCard = db.select().from(cards).where(eq(cards.id, id)).get();
    return NextResponse.json(updatedCard);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Revert failed" },
      { status: 500 }
    );
  }
}
