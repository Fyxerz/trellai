import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getRepositories } from "@/lib/db/repositories";

/**
 * GET /api/board-invites — List pending board invites for the current user
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repos = getRepositories("supabase", supabase);
    if (!repos.boardInvites) {
      return NextResponse.json([]);
    }
    const invites = await repos.boardInvites.findPendingByEmail(user.email ?? "");
    return NextResponse.json(invites);
  } catch (err) {
    console.error("Failed to fetch board invites:", err);
    return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 });
  }
}

/**
 * PATCH /api/board-invites — Accept or decline a board invite
 *
 * Body: { inviteId: string, action: "accept" | "decline" }
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { inviteId, action } = await req.json();

  if (!inviteId || !["accept", "decline"].includes(action)) {
    return NextResponse.json({ error: "inviteId and action (accept/decline) are required" }, { status: 400 });
  }

  try {
    // Use admin client to bypass RLS for cross-table operations
    const adminClient = getSupabaseAdminClient();
    const repos = getRepositories("supabase", adminClient);
    if (!repos.boardInvites || !repos.boardCollaborators) {
      return NextResponse.json({ error: "Board invites not supported" }, { status: 400 });
    }

    const invite = await repos.boardInvites.findById(inviteId);
    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    // Verify the invite belongs to this user
    if (invite.email !== user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json({ error: "Invite is no longer pending" }, { status: 400 });
    }

    if (action === "accept") {
      // Add user as board collaborator
      const existing = await repos.boardCollaborators.findByProjectAndUser(
        invite.projectId,
        user.id
      );
      if (!existing) {
        await repos.boardCollaborators.create({
          projectId: invite.projectId,
          userId: user.id,
          role: invite.role,
        });
      }
      await repos.boardInvites.update(inviteId, { status: "accepted" });
    } else {
      await repos.boardInvites.update(inviteId, { status: "declined" });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to respond to board invite:", err);
    return NextResponse.json({ error: "Failed to respond to invite" }, { status: 500 });
  }
}
