import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { getOptionalUser, assertProjectAccessForUser } from "@/lib/auth";
import { execSync } from "child_process";

const repos = getLocalRepositories();

export async function GET(
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

  try {
    const remotes = execSync("git remote", {
      cwd: project.repoPath,
      encoding: "utf-8",
      timeout: 10_000,
    }).trim();

    const hasOrigin = remotes.split("\n").some((r) => r.trim() === "origin");

    return NextResponse.json({ hasOrigin });
  } catch {
    return NextResponse.json({ hasOrigin: false });
  }
}
