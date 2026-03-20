import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { getOptionalUser, assertProjectAccessForUser } from "@/lib/auth";
import { execSync } from "child_process";

const repos = getLocalRepositories();

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOptionalUser();
  const { id } = await params;

  const hasAccess = await assertProjectAccessForUser(id, user);
  if (!hasAccess) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const project = await repos.projects.findById(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const repoPath = project.repoPath;

  // Check if remote exists
  try {
    const remotes = execSync("git remote", {
      cwd: repoPath,
      encoding: "utf-8",
      timeout: 10_000,
    }).trim();
    if (!remotes.includes("origin")) {
      return NextResponse.json(
        { error: "No origin remote configured" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to check git remotes" },
      { status: 500 }
    );
  }

  // Determine main branch
  let mainBranch = "main";
  try {
    const result = execSync(
      "git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || echo refs/heads/main",
      { cwd: repoPath, encoding: "utf-8" }
    ).trim();
    mainBranch = result.split("/").pop() || "main";
  } catch {
    // default to main
  }

  // Get the current HEAD commit before push
  let commitSha = "";
  try {
    commitSha = execSync(`git rev-parse --short ${mainBranch}`, {
      cwd: repoPath,
      encoding: "utf-8",
      timeout: 10_000,
    }).trim();
  } catch {
    // non-fatal
  }

  // Push main branch
  try {
    execSync(`git push origin ${mainBranch}`, {
      cwd: repoPath,
      stdio: "pipe",
      timeout: 60_000,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error during push";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    branch: mainBranch,
    commitSha,
  });
}
