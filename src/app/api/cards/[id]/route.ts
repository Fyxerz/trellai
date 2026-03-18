import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import fs from "fs";
import path from "path";

const repos = getLocalRepositories();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const card = repos.cards.findById(id);
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...card,
    testResults: card.testResults ? JSON.parse(card.testResults) : null,
  });
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

  repos.cards.update(id, updateData);

  const card = repos.cards.findById(id);
  return NextResponse.json({
    ...card,
    testResults: card?.testResults ? JSON.parse(card.testResults) : null,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Clean up uploaded files on disk
  const card = repos.cards.findById(id);
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
  repos.files.deleteByCardId(id);
  repos.chatMessages.deleteByCardId(id);
  repos.checklistItems.deleteByCardId(id);
  repos.cards.delete(id);
  return NextResponse.json({ success: true });
}
