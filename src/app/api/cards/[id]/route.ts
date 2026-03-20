import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { getOptionalUser, assertCardAccessForUser } from "@/lib/auth";
import fs from "fs";
import path from "path";

const repos = getLocalRepositories();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOptionalUser();
  const { id } = await params;

  const hasAccess = await assertCardAccessForUser(id, user);
  if (!hasAccess) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const card = await repos.cards.findById(id);
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...card,
    testResults: card.testResults ? JSON.parse(card.testResults) : null,
    isIcebox: !!card.isIcebox,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOptionalUser();
  const { id } = await params;

  const hasAccess = await assertCardAccessForUser(id, user);
  if (!hasAccess) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

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
  if (body.isIcebox !== undefined)
    updateData.isIcebox = body.isIcebox ? 1 : 0;

  await repos.cards.update(id, updateData);

  const card = await repos.cards.findById(id);
  return NextResponse.json({
    ...card,
    testResults: card?.testResults ? JSON.parse(card.testResults) : null,
    isIcebox: !!card?.isIcebox,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOptionalUser();
  const { id } = await params;

  const hasAccess = await assertCardAccessForUser(id, user);
  if (!hasAccess) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  // Clean up uploaded files on disk
  const card = await repos.cards.findById(id);
  if (card) {
    const cardFilesDir = path.join(
      process.cwd(),
      "data",
      "uploads",
      card.projectId,
      "cards",
      id
    );
    try {
      fs.rmSync(cardFilesDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  }

  // DB cascade handles files table rows, but delete explicitly for safety
  await repos.files.deleteByCardId(id);
  await repos.chatMessages.deleteByCardId(id);
  await repos.checklistItems.deleteByCardId(id);
  await repos.cards.delete(id);
  return NextResponse.json({ success: true });
}
