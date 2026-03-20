import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRepositories } from "@/lib/db/repositories";

/**
 * PATCH /api/invites/:id — Accept or decline an invite
 *
 * Body: { action: "accept" | "decline" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body;

  if (!action || !["accept", "decline"].includes(action)) {
    return NextResponse.json({ error: "Action must be 'accept' or 'decline'" }, { status: 400 });
  }

  const repos = getRepositories("supabase");
  if (!repos.invites || !repos.teamMembers) {
    return NextResponse.json({ error: "Invites not available" }, { status: 501 });
  }

  try {
    // Get the invite
    const invite = await repos.invites.findById(id);
    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    // Verify the invite is for the current user
    if (invite.email !== user.email) {
      return NextResponse.json({ error: "This invite is not for you" }, { status: 403 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json({ error: `Invite already ${invite.status}` }, { status: 400 });
    }

    if (action === "accept") {
      // Add user to team
      await repos.teamMembers.create({
        teamId: invite.teamId,
        userId: user.id,
        role: invite.role,
      });
      await repos.invites.update(id, { status: "accepted" });
      return NextResponse.json({ success: true, action: "accepted" });
    } else {
      await repos.invites.update(id, { status: "declined" });
      return NextResponse.json({ success: true, action: "declined" });
    }
  } catch (error) {
    console.error("[invites] PATCH error:", error);
    return NextResponse.json({ error: "Failed to process invite" }, { status: 500 });
  }
}
