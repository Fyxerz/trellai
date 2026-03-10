import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards, chatMessages, checklistItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const card = db.select().from(cards).where(eq(cards.id, id)).get();
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  return NextResponse.json(card);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = { updatedAt: now };

  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.type !== undefined) updateData.type = body.type;
  if (body.column !== undefined) updateData.column = body.column;
  if (body.position !== undefined) updateData.position = body.position;
  if (body.branchName !== undefined) updateData.branchName = body.branchName;
  if (body.worktreePath !== undefined) updateData.worktreePath = body.worktreePath;
  if (body.claudeSessionId !== undefined)
    updateData.claudeSessionId = body.claudeSessionId;
  if (body.agentStatus !== undefined)
    updateData.agentStatus = body.agentStatus;

  db.update(cards).set(updateData).where(eq(cards.id, id)).run();

  const card = db.select().from(cards).where(eq(cards.id, id)).get();
  return NextResponse.json(card);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  db.delete(chatMessages).where(eq(chatMessages.cardId, id)).run();
  db.delete(checklistItems).where(eq(checklistItems.cardId, id)).run();
  db.delete(cards).where(eq(cards.id, id)).run();
  return NextResponse.json({ success: true });
}
