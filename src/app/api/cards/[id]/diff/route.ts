import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { worktreeManager } from "@/lib/agents/worktree-manager";
import { queueManager } from "@/lib/agents/queue-manager";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const card = db.select().from(cards).where(eq(cards.id, id)).get();
  if (!card || (!card.branchName && !card.commitSha)) {
    return NextResponse.json({ diff: "" });
  }

  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, card.projectId))
    .get();
  if (!project) {
    return NextResponse.json({ diff: "" });
  }

  // Queue mode: diff from commit
  if (card.commitSha) {
    const diff = queueManager.getDiffForCommit(project.repoPath, card.commitSha);
    return NextResponse.json({ diff });
  }

  // Worktree mode: diff from branch
  const diff = worktreeManager.getDiff(project.repoPath, card.branchName!);
  return NextResponse.json({ diff });
}
