import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getRepositories } from "@/lib/db/repositories";

/**
 * GET /api/teams/:id — Get a team by ID
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
  if (!repos.teams) {
    return NextResponse.json({ error: "Teams not available" }, { status: 501 });
  }

  try {
    const team = await repos.teams.findById(id);
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    return NextResponse.json(team);
  } catch (error) {
    console.error("[teams] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 });
  }
}

/**
 * PATCH /api/teams/:id — Update a team
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
  const repos = getRepositories("supabase", getSupabaseAdminClient());
  if (!repos.teams) {
    return NextResponse.json({ error: "Teams not available" }, { status: 501 });
  }

  try {
    await repos.teams.update(id, { name: body.name });
    const updated = await repos.teams.findById(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[teams] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
  }
}

/**
 * DELETE /api/teams/:id — Delete a team
 */
export async function DELETE(
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
  if (!repos.teams) {
    return NextResponse.json({ error: "Teams not available" }, { status: 501 });
  }

  try {
    // Prevent deleting personal teams
    const team = await repos.teams.findById(id);
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    if (team.isPersonal) {
      return NextResponse.json({ error: "Cannot delete personal team" }, { status: 400 });
    }

    await repos.teams.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[teams] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete team" }, { status: 500 });
  }
}
