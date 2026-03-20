import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRepositories } from "@/lib/db/repositories";

/**
 * PATCH /api/teams/:id/members/:memberId — Update a member's role
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { memberId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { role } = body;

  if (!role || !["owner", "admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const repos = getRepositories("supabase", supabase);
  if (!repos.teamMembers) {
    return NextResponse.json({ error: "Team members not available" }, { status: 501 });
  }

  try {
    await repos.teamMembers.update(memberId, { role });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[team-members] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }
}

/**
 * DELETE /api/teams/:id/members/:memberId — Remove a member from a team
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { memberId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repos = getRepositories("supabase", supabase);
  if (!repos.teamMembers) {
    return NextResponse.json({ error: "Team members not available" }, { status: 501 });
  }

  try {
    await repos.teamMembers.delete(memberId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[team-members] DELETE error:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
