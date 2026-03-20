import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRepositories } from "@/lib/db/repositories";
import { getAuthUser, unauthorized, forbidden, getProjectRole } from "@/lib/auth";

/**
 * GET /api/projects/:id/collaborators — List board collaborators
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const role = await getProjectRole(id, user.id);
  if (!role) return forbidden();

  try {
    const supabase = await createServerSupabaseClient();
    const repos = getRepositories("supabase", supabase);
    if (!repos.boardCollaborators) {
      return NextResponse.json([]);
    }
    const collaborators = await repos.boardCollaborators.findByProjectId(id);
    return NextResponse.json(collaborators);
  } catch (err) {
    console.error("Failed to list board collaborators:", err);
    return NextResponse.json({ error: "Failed to list collaborators" }, { status: 500 });
  }
}

/**
 * POST /api/projects/:id/collaborators — Add a board collaborator directly (by userId)
 *
 * Body: { userId: string, role: "viewer" | "editor" | "admin" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return unauthorized();

  // Only team owners/admins or board admins can add collaborators
  const callerRole = await getProjectRole(id, user.id);
  if (callerRole !== "admin") {
    return forbidden();
  }

  const { userId, role } = await req.json();
  if (!userId || !role) {
    return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
  }

  const validRoles = ["viewer", "editor", "admin"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const repos = getRepositories("supabase", supabase);
    if (!repos.boardCollaborators) {
      return NextResponse.json({ error: "Board collaborators not supported" }, { status: 400 });
    }

    // Check if already a collaborator
    const existing = await repos.boardCollaborators.findByProjectAndUser(id, userId);
    if (existing) {
      return NextResponse.json({ error: "User is already a collaborator" }, { status: 409 });
    }

    const collab = await repos.boardCollaborators.create({
      projectId: id,
      userId,
      role,
    });
    return NextResponse.json(collab, { status: 201 });
  } catch (err) {
    console.error("Failed to add board collaborator:", err);
    return NextResponse.json({ error: "Failed to add collaborator" }, { status: 500 });
  }
}
