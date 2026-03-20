import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRepositories } from "@/lib/db/repositories";
import { getAuthUser, unauthorized, forbidden, getProjectRole } from "@/lib/auth";

/**
 * GET /api/projects/:id/invites — List board invites for a project
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
    if (!repos.boardInvites) {
      return NextResponse.json([]);
    }
    const invites = await repos.boardInvites.findByProjectId(id);
    return NextResponse.json(invites);
  } catch (err) {
    console.error("Failed to list board invites:", err);
    return NextResponse.json({ error: "Failed to list invites" }, { status: 500 });
  }
}

/**
 * POST /api/projects/:id/invites — Send a board invite
 *
 * Body: { email: string, role: "viewer" | "editor" | "admin" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return unauthorized();

  // Only team owners/admins or board admins can send invites
  const callerRole = await getProjectRole(id, user.id);
  if (callerRole !== "admin") {
    return forbidden();
  }

  const { email, role } = await req.json();
  if (!email || !role) {
    return NextResponse.json({ error: "email and role are required" }, { status: 400 });
  }

  const validRoles = ["viewer", "editor", "admin"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const repos = getRepositories("supabase", supabase);
    if (!repos.boardInvites) {
      return NextResponse.json({ error: "Board invites not supported" }, { status: 400 });
    }

    // Check for existing pending invite
    const existing = await repos.boardInvites.findByProjectId(id);
    const duplicate = existing.find(
      (inv) => inv.email === email && inv.status === "pending"
    );
    if (duplicate) {
      return NextResponse.json({ error: "An invite for this email is already pending" }, { status: 409 });
    }

    // Check if user is already a collaborator
    if (repos.boardCollaborators && repos.users) {
      const targetUser = await repos.users.findByEmail(email);
      if (targetUser) {
        const existingCollab = await repos.boardCollaborators.findByProjectAndUser(id, targetUser.id);
        if (existingCollab) {
          return NextResponse.json({ error: "User is already a collaborator on this board" }, { status: 409 });
        }
      }
    }

    const invite = await repos.boardInvites.create({
      projectId: id,
      email,
      role,
      invitedBy: user.id,
    });
    return NextResponse.json(invite, { status: 201 });
  } catch (err) {
    console.error("Failed to send board invite:", err);
    return NextResponse.json({ error: "Failed to send invite" }, { status: 500 });
  }
}
