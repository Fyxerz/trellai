import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRepositories } from "@/lib/db/repositories";
import { getAuthUser, unauthorized, forbidden, getProjectRole } from "@/lib/auth";

/**
 * PATCH /api/projects/:id/collaborators/:collaboratorId — Update collaborator role
 *
 * Body: { role: "viewer" | "editor" | "admin" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; collaboratorId: string }> }
) {
  const { id, collaboratorId } = await params;
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const callerRole = await getProjectRole(id, user.id);
  if (callerRole !== "admin") {
    return forbidden();
  }

  const { role } = await req.json();
  const validRoles = ["viewer", "editor", "admin"];
  if (!role || !validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const repos = getRepositories("supabase", supabase);
    if (!repos.boardCollaborators) {
      return NextResponse.json({ error: "Board collaborators not supported" }, { status: 400 });
    }

    const collab = await repos.boardCollaborators.findById(collaboratorId);
    if (!collab || collab.projectId !== id) {
      return NextResponse.json({ error: "Collaborator not found" }, { status: 404 });
    }

    await repos.boardCollaborators.update(collaboratorId, { role });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to update board collaborator:", err);
    return NextResponse.json({ error: "Failed to update collaborator" }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/:id/collaborators/:collaboratorId — Remove collaborator
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; collaboratorId: string }> }
) {
  const { id, collaboratorId } = await params;
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const callerRole = await getProjectRole(id, user.id);
  if (callerRole !== "admin") {
    return forbidden();
  }

  try {
    const supabase = await createServerSupabaseClient();
    const repos = getRepositories("supabase", supabase);
    if (!repos.boardCollaborators) {
      return NextResponse.json({ error: "Board collaborators not supported" }, { status: 400 });
    }

    const collab = await repos.boardCollaborators.findById(collaboratorId);
    if (!collab || collab.projectId !== id) {
      return NextResponse.json({ error: "Collaborator not found" }, { status: 404 });
    }

    await repos.boardCollaborators.delete(collaboratorId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to remove board collaborator:", err);
    return NextResponse.json({ error: "Failed to remove collaborator" }, { status: 500 });
  }
}
