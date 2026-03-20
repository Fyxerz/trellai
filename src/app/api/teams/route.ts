import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRepositories } from "@/lib/db/repositories";

/**
 * GET /api/teams — List teams the current user belongs to
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repos = getRepositories("supabase");
  if (!repos.teams) {
    return NextResponse.json({ error: "Teams not available in this storage mode" }, { status: 501 });
  }

  try {
    const teams = await repos.teams.findByUserId(user.id);
    return NextResponse.json(teams);
  } catch (error) {
    console.error("[teams] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
}

/**
 * POST /api/teams — Create a new team
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const repos = getRepositories("supabase");
  if (!repos.teams || !repos.teamMembers) {
    return NextResponse.json({ error: "Teams not available in this storage mode" }, { status: 501 });
  }

  try {
    // Create the team
    const team = await repos.teams.create({ name, isPersonal: false });

    // Add the creator as owner
    await repos.teamMembers.create({
      teamId: team.id,
      userId: user.id,
      role: "owner",
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error("[teams] POST error:", error);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }
}
