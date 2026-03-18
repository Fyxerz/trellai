import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { v4 as uuid } from "uuid";

const repos = getLocalRepositories();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const items = repos.checklistItems.findByCardId(id);
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
  const existing = repos.checklistItems.findByCardId(cardId);
  const position = existing.length;

  repos.checklistItems.create({
    id,
    cardId,
    text: body.text,
    checked: false,
    position,
    createdAt: now,
  });

  const item = repos.checklistItems.findById(id);
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

  repos.checklistItems.update(itemId, cardId, updateData as { text?: string; checked?: boolean; position?: number });

  const item = repos.checklistItems.findById(itemId);
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

  repos.checklistItems.delete(itemId, cardId);

  return NextResponse.json({ success: true });
}
