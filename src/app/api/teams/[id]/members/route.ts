import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getRepositories } from "@/lib/db/repositories";

/**
 * GET /api/teams/:id/members — List team members
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repos = getRepositories("supabase", getSupabaseAdminClient());
  if (!repos.teamMembers) {
    return NextResponse.json({ error: "Team members not available" }, { status: 501 });
  }

  try {
    const members = await repos.teamMembers.findByTeamId(id);
    return NextResponse.json(members);
  } catch (error) {
    console.error("[team-members] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

/**
 * POST /api/teams/:id/members — Add a member to a team
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { userId, role = "member" } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (!["owner", "admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const repos = getRepositories("supabase", getSupabaseAdminClient());
  if (!repos.teamMembers) {
    return NextResponse.json({ error: "Team members not available" }, { status: 501 });
  }

  try {
    await repos.teamMembers.create({ teamId, userId, role });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[team-members] POST error:", error);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}
