import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRepositories } from "@/lib/db/repositories";

/**
 * GET /api/projects/shared — List projects the current user is a board collaborator on
 * (but NOT a team member of). These appear in the "Shared with me" section.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json([]);
  }

  try {
    const repos = getRepositories("supabase", supabase);
    if (!repos.boardCollaborators) {
      return NextResponse.json([]);
    }

    // Get all boards user is a collaborator on
    const collaborations = await repos.boardCollaborators.findByUserId(user.id);
    if (collaborations.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch project details for each collaboration
    const sharedProjects = [];
    for (const collab of collaborations) {
      const project = await repos.projects.findById(collab.projectId);
      if (project) {
        sharedProjects.push({
          project,
          role: collab.role,
        });
      }
    }

    return NextResponse.json(sharedProjects);
  } catch (err) {
    console.error("Failed to fetch shared projects:", err);
    return NextResponse.json([]);
  }
}
