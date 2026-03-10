import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, cards } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { existsSync, statSync } from "fs";
import { execSync } from "child_process";

export async function GET() {
  const allProjects = db.select().from(projects).all();
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

  db.insert(projects)
    .values({
      id,
      name: body.name,
      repoPath: body.repoPath,
      createdAt: now,
    })
    .run();

  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .get();
  return NextResponse.json(project, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, name, mode } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Mode toggle guard: reject if cards are in production or review
  if (mode && (mode === "worktree" || mode === "queue")) {
    const activeCards = db
      .select()
      .from(cards)
      .where(
        and(
          eq(cards.projectId, id),
          inArray(cards.column, ["production", "review"])
        )
      )
      .all();

    if (activeCards.length > 0) {
      return NextResponse.json(
        { error: "Cannot switch modes while cards are in production or review. Move them to features or complete first." },
        { status: 409 }
      );
    }

    db.update(projects).set({ mode }).where(eq(projects.id, id)).run();
  }

  if (name) {
    db.update(projects).set({ name }).where(eq(projects.id, id)).run();
  }

  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .get();
  return NextResponse.json(project);
}
