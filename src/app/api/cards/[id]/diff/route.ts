import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { getAuthUser, unauthorized, assertCardAccess } from "@/lib/auth";
import { worktreeManager } from "@/lib/agents/worktree-manager";
import { queueManager } from "@/lib/agents/queue-manager";

const repos = getLocalRepositories();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const hasAccess = await assertCardAccess(id, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const card = await repos.cards.findById(id);
  if (!card || (!card.branchName && !card.commitSha)) {
    return NextResponse.json({ diff: "" });
  }

  const project = await repos.projects.findById(card.projectId);
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
