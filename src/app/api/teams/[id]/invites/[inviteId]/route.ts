import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRepositories } from "@/lib/db/repositories";

/**
 * PATCH /api/teams/:id/invites/:inviteId — Update an invite (e.g., change role)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  const { inviteId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const repos = getRepositories("supabase", getSupabaseAdminClient());
  if (!repos.invites) {
    return NextResponse.json({ error: "Invites not available" }, { status: 501 });
  }

  try {
    const updateData: Partial<Pick<import("@/lib/db/repositories/types").InviteRow, "status" | "role">> = {};
    if (body.status) updateData.status = body.status;
    if (body.role) updateData.role = body.role;

    await repos.invites.update(inviteId, updateData);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[invites] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update invite" }, { status: 500 });
  }
}

/**
 * DELETE /api/teams/:id/invites/:inviteId — Delete/revoke an invite
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  const { inviteId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repos = getRepositories("supabase", getSupabaseAdminClient());
  if (!repos.invites) {
    return NextResponse.json({ error: "Invites not available" }, { status: 501 });
  }

  try {
    await repos.invites.delete(inviteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[invites] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete invite" }, { status: 500 });
  }
}
