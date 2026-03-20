import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getRepositories } from "@/lib/db/repositories";

/**
 * GET /api/teams/:id/invites — List invites for a team
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
  if (!repos.invites) {
    return NextResponse.json({ error: "Invites not available" }, { status: 501 });
  }

  try {
    const invites = await repos.invites.findByTeamId(id);
    return NextResponse.json(invites);
  } catch (error) {
    console.error("[invites] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 });
  }
}

/**
 * POST /api/teams/:id/invites — Create an invite
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
  const { email, role = "member" } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Invalid role. Must be 'admin' or 'member'" }, { status: 400 });
  }

  const repos = getRepositories("supabase", getSupabaseAdminClient());
  if (!repos.invites) {
    return NextResponse.json({ error: "Invites not available" }, { status: 501 });
  }

  try {
    const invite = await repos.invites.create({
      teamId,
      email: email.toLowerCase().trim(),
      role,
      invitedBy: user.id,
    });
    return NextResponse.json(invite, { status: 201 });
  } catch (error) {
    console.error("[invites] POST error:", error);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
}
