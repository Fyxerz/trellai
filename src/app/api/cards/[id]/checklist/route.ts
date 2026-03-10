import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checklistItems } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const items = db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.cardId, id))
    .orderBy(checklistItems.position)
    .all();
  return NextResponse.json(items);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cardId } = await params;
  const body = await req.json();
  const id = uuid();
  const now = new Date().toISOString();

  // Get the next position
  const existing = db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.cardId, cardId))
    .all();
  const position = existing.length;

  db.insert(checklistItems)
    .values({
      id,
      cardId,
      text: body.text,
      checked: false,
      position,
      createdAt: now,
    })
    .run();

  const item = db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.id, id))
    .get();
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cardId } = await params;
  const body = await req.json();
  const { itemId, ...updates } = body;

  if (!itemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (updates.text !== undefined) updateData.text = updates.text;
  if (updates.checked !== undefined) updateData.checked = updates.checked;
  if (updates.position !== undefined) updateData.position = updates.position;

  db.update(checklistItems)
    .set(updateData)
    .where(
      and(eq(checklistItems.id, itemId), eq(checklistItems.cardId, cardId))
    )
    .run();

  const item = db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.id, itemId))
    .get();
  return NextResponse.json(item);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cardId } = await params;
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  db.delete(checklistItems)
    .where(
      and(eq(checklistItems.id, itemId), eq(checklistItems.cardId, cardId))
    )
    .run();

  return NextResponse.json({ success: true });
}
