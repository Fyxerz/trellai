import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
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

  const repos = getRepositories("supabase", supabase);
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
 *
 * Uses the admin (service-role) client for both operations because:
 * 1. The teams INSERT RLS policy requires `auth.uid() IS NOT NULL` —
 *    the server-side authenticated client satisfies this, but using admin
 *    avoids edge cases with token expiry during the request.
 * 2. The team_members INSERT RLS policy requires `has_team_role(...)`,
 *    which is a chicken-and-egg problem for the first member. The
 *    `handle_new_user` trigger uses SECURITY DEFINER for the same reason.
 *
 * Auth is validated first via the cookie-aware server client, so this is safe.
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

  let adminClient;
  try {
    adminClient = getSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set" },
      { status: 500 }
    );
  }

  const adminRepos = getRepositories("supabase", adminClient);
  if (!adminRepos.teams || !adminRepos.teamMembers) {
    return NextResponse.json({ error: "Teams not available in this storage mode" }, { status: 501 });
  }

  try {
    // Create team + add creator as owner (both via admin to bypass RLS bootstrap issue)
    const team = await adminRepos.teams.create({ name, isPersonal: false });

    await adminRepos.teamMembers.create({
      teamId: team.id,
      userId: user.id,
      role: "owner",
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error: unknown) {
    console.error("[teams] POST error:", error);
    // Supabase errors have .message and .code; plain Error has .message
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as Record<string, unknown>).message)
          : JSON.stringify(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
