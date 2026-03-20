/**
 * Shared auth helpers for API route protection.
 *
 * - `getAuthUser()` extracts and validates the Supabase session
 * - `getOptionalUser()` same as getAuthUser — signals that null is expected (anonymous)
 * - `unauthorized()` returns a standard 401 response
 * - `assertProjectAccess()` checks if a user owns the project or is a team member
 * - `assertProjectAccessForUser()` checks access for an optional user (anonymous or authenticated)
 * - `assertCardAccess()` checks project access via the card's parent project
 * - `assertCardAccessForUser()` checks card access for an optional user
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getLocalRepositories, getRepositories } from "@/lib/db/repositories";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
}

// ── Dev bypass user ────────────────────────────────────────────────────────

const DEV_USER: AuthUser = {
  id: "dev-user",
  email: "dev@localhost",
};

// ── Auth extraction ────────────────────────────────────────────────────────

/**
 * Extract and validate the authenticated user from the Supabase session.
 *
 * When `DEV_BYPASS_AUTH=true` is set, returns a synthetic dev user
 * so local development works without Supabase credentials.
 *
 * @returns The authenticated user, or `null` if unauthenticated.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  if (process.env.DEV_BYPASS_AUTH === "true") {
    return DEV_USER;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;
    return { id: user.id, email: user.email ?? "" };
  } catch {
    return null;
  }
}

/**
 * Get the current user if logged in, or null for anonymous users.
 * Semantically identical to getAuthUser() but signals that null is a valid/expected state.
 * Use this for routes that allow anonymous access to local boards.
 */
export const getOptionalUser = getAuthUser;

// ── Response helpers ───────────────────────────────────────────────────────

/** Standard 401 Unauthorized response. */
export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Standard 403 Forbidden response. */
export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ── Access checks ──────────────────────────────────────────────────────────

/**
 * Check if a user has access to a project.
 *
 * Access is granted if:
 * 1. The project has no userId (legacy/unassigned project — backward compat)
 * 2. The project's userId matches the authenticated user
 * 3. The project belongs to a team the user is a member of
 *
 * @returns `true` if the user has access, `false` otherwise.
 */
export async function assertProjectAccess(
  projectId: string,
  userId: string
): Promise<boolean> {
  const repos = getLocalRepositories();
  const project = await repos.projects.findById(projectId);
  if (!project) return false;

  // Owner access or legacy project (null userId)
  if (project.userId === userId || project.userId === null) return true;

  // Team-based access
  if (project.teamId) {
    try {
      const supabase = await createServerSupabaseClient();
      const supaRepos = getRepositories("supabase", supabase);
      if (supaRepos.teamMembers) {
        const membership = await supaRepos.teamMembers.findByTeamAndUser(
          project.teamId,
          userId
        );
        if (membership) return true;
      }
    } catch {
      // Supabase may not be configured — deny access
    }
  }

  return false;
}

/**
 * Check if an optional user (authenticated or anonymous) has access to a project.
 *
 * For anonymous users (user === null): only projects with null userId are accessible.
 * For authenticated users: delegates to assertProjectAccess().
 */
export async function assertProjectAccessForUser(
  projectId: string,
  user: AuthUser | null
): Promise<boolean> {
  const repos = getLocalRepositories();
  const project = await repos.projects.findById(projectId);
  if (!project) return false;

  // Anonymous users can only access projects with null userId (local anonymous boards)
  if (!user) {
    return project.userId === null;
  }

  // Authenticated users go through the normal access check
  return assertProjectAccess(projectId, user.id);
}

/**
 * Check if a user has access to a card (via the card's parent project).
 *
 * @returns `true` if the user has access, `false` otherwise.
 */
export async function assertCardAccess(
  cardId: string,
  userId: string
): Promise<boolean> {
  const repos = getLocalRepositories();
  const card = await repos.cards.findById(cardId);
  if (!card) return false;
  return assertProjectAccess(card.projectId, userId);
}

/**
 * Check if an optional user (authenticated or anonymous) has access to a card.
 */
export async function assertCardAccessForUser(
  cardId: string,
  user: AuthUser | null
): Promise<boolean> {
  const repos = getLocalRepositories();
  const card = await repos.cards.findById(cardId);
  if (!card) return false;
  return assertProjectAccessForUser(card.projectId, user);
}
