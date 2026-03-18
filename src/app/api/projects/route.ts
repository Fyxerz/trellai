import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { v4 as uuid } from "uuid";
import { existsSync, statSync } from "fs";
import { execSync } from "child_process";
import { generateProjectDocs } from "@/lib/agents/project-docs-generator";

const repos = getLocalRepositories();

export async function GET() {
  const allProjects = repos.projects.findAll();
  return NextResponse.json(allProjects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.repoPath || !existsSync(body.repoPath) || !statSync(body.repoPath).isDirectory()) {
    return NextResponse.json(
      { error: "Repository path does not exist or is not a directory" },
      { status: 400 }
    );
  }

  // Auto-init git repo if the directory isn't one yet
  try {
    execSync("git rev-parse --git-dir", { cwd: body.repoPath, stdio: "pipe" });
  } catch {
    execSync("git init", { cwd: body.repoPath, stdio: "pipe" });
  }

  const id = uuid();
  const now = new Date().toISOString();

  repos.projects.create({
    id,
    name: body.name,
    repoPath: body.repoPath,
    mode: "worktree",
    createdAt: now,
  });

  // Generate .claude/ documentation files (non-blocking on failure)
  let docsGenerated = false;
  try {
    const docsResult = await generateProjectDocs(body.repoPath, body.name);
    docsGenerated = docsResult.created.length > 0;
  } catch (err) {
    console.error("Failed to generate project docs:", err);
  }

  const project = repos.projects.findById(id);
  return NextResponse.json({ ...project, docsGenerated }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, name, mode } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Mode toggle guard: reject if cards are in production or review
  if (mode && (mode === "worktree" || mode === "queue")) {
    const activeCards = repos.cards.findByConditions({
      projectId: id,
      column: ["production", "review"],
    });

    if (activeCards.length > 0) {
      return NextResponse.json(
        { error: "Cannot switch modes while cards are in production or review. Move them to features or complete first." },
        { status: 409 }
      );
    }

    repos.projects.update(id, { mode });
  }

  if (name) {
    repos.projects.update(id, { name });
  }

  const project = repos.projects.findById(id);
  return NextResponse.json(project);
}
