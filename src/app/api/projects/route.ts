import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { getOptionalUser, unauthorized, assertProjectAccessForUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import { existsSync, statSync } from "fs";
import { execSync } from "child_process";
import { generateProjectDocs } from "@/lib/agents/project-docs-generator";
import { RepoManager } from "@/lib/agents/repo-manager";

const repos = getLocalRepositories();

export async function GET() {
  const user = await getOptionalUser();

  const allProjects = await repos.projects.findAll();

  // Filter by userId (multi-tenancy):
  // - Authenticated: show user's projects + legacy/anonymous projects (null userId)
  // - Anonymous: show only projects with null userId
  const filtered = user
    ? allProjects.filter((p) => p.userId === user.id || p.userId === null)
    : allProjects.filter((p) => p.userId === null);

  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const user = await getOptionalUser();

  const body = await req.json();

  // Team boards require authentication
  if (body.teamId && !user) {
    return unauthorized();
  }

  const isGitUrl = RepoManager.isGitUrl(body.repoPath || "");
  let repoPath = body.repoPath;
  let repoUrl: string | null = null;

  if (isGitUrl) {
    // GitHub URL provided — auto-clone to workspace
    repoUrl = body.repoPath;
    try {
      const manager = new RepoManager();
      repoPath = await manager.ensureRepo(repoUrl, body.name);
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to clone repository: ${err instanceof Error ? err.message : "Unknown error"}` },
        { status: 400 }
      );
    }
  } else {
    // Local path — validate it exists
    if (!repoPath || !existsSync(repoPath) || !statSync(repoPath).isDirectory()) {
      return NextResponse.json(
        { error: "Repository path does not exist or is not a directory" },
        { status: 400 }
      );
    }

    // Auto-init git repo if the directory isn't one yet
    try {
      execSync("git rev-parse --git-dir", { cwd: repoPath, stdio: "pipe" });
    } catch {
      execSync("git init", { cwd: repoPath, stdio: "pipe" });
    }
  }

  const id = uuid();
  const now = new Date().toISOString();

  await repos.projects.create({
    id,
    name: body.name,
    repoPath,
    repoUrl,
    mode: "worktree",
    userId: user?.id ?? null,
    teamId: body.teamId ?? null,
    createdAt: now,
  });

  // Generate .claude/ documentation files (non-blocking on failure)
  let docsGenerated = false;
  try {
    const docsResult = await generateProjectDocs(repoPath, body.name);
    docsGenerated = docsResult.created.length > 0;
  } catch (err) {
    console.error("Failed to generate project docs:", err);
  }

  const project = await repos.projects.findById(id);
  return NextResponse.json({ ...project, docsGenerated }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getOptionalUser();

  const body = await req.json();
  const { id, name, mode } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Verify project access
  const hasAccess = await assertProjectAccessForUser(id, user);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Mode toggle guard: reject if cards are in production or review
  if (mode && (mode === "worktree" || mode === "queue")) {
    const activeCards = await repos.cards.findByConditions({
      projectId: id,
      column: ["production", "review"],
    });

    if (activeCards.length > 0) {
      return NextResponse.json(
        { error: "Cannot switch modes while cards are in production or review. Move them to features or complete first." },
        { status: 409 }
      );
    }

    await repos.projects.update(id, { mode });
  }

  if (name) {
    await repos.projects.update(id, { name });
  }

  const project = await repos.projects.findById(id);
  return NextResponse.json(project);
}
