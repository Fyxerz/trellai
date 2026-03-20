import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRepositories } from "@/lib/db/repositories";

/**
 * GET /api/invites — List pending invites for the current user
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repos = getRepositories("supabase");
  if (!repos.invites) {
    return NextResponse.json({ error: "Invites not available" }, { status: 501 });
  }

  try {
    const email = user.email;
    if (!email) {
      return NextResponse.json({ error: "User has no email" }, { status: 400 });
    }

    const invites = await repos.invites.findPendingByEmail(email);
    return NextResponse.json(invites);
  } catch (error) {
    console.error("[invites] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 });
  }
}
