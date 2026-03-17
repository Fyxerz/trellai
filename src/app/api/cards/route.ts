import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards, checklistItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  const allCards = db
    .select()
    .from(cards)
    .where(eq(cards.projectId, projectId))
    .all();

  // Attach checklist counts
  const enriched = allCards.map((card) => {
    const items = db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.cardId, card.id))
      .all();
    return {
      ...card,
      testResults: card.testResults ? JSON.parse(card.testResults) : null,
      checklistTotal: items.length,
      checklistChecked: items.filter((i) => i.checked).length,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = uuid();
  const now = new Date().toISOString();

  // Get max position in the target column
  const existing = db
    .select()
    .from(cards)
    .where(eq(cards.projectId, body.projectId))
    .all();

  const columnCards = existing.filter(
    (c) => c.column === (body.column || "features")
  );
  const maxPos = columnCards.reduce(
    (max, c) => Math.max(max, c.position),
    -1
  );

  db.insert(cards)
    .values({
      id,
      projectId: body.projectId,
      title: body.title,
      description: body.description || "",
      type: body.type || "feature",
      column: body.column || "features",
      position: maxPos + 1,
      agentStatus: "idle",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const card = db.select().from(cards).where(eq(cards.id, id)).get();
  return NextResponse.json(card, { status: 201 });
}
