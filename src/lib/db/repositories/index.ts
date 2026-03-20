/**
 * Repository factory — returns the correct repository implementation
 * based on the project's storage mode.
 */

import type { RepositoryContext } from "./types";
import {
  SqliteProjectRepository,
  SqliteCardRepository,
  SqliteChecklistItemRepository,
  SqliteChatMessageRepository,
  SqliteFileRepository,
} from "./sqlite";
import {
  SupabaseProjectRepository,
  SupabaseCardRepository,
  SupabaseChecklistItemRepository,
  SupabaseChatMessageRepository,
  SupabaseFileRepository,
  SupabaseUserRepository,
  SupabaseTeamRepository,
  SupabaseTeamMemberRepository,
  SupabaseInviteRepository,
} from "./supabase";

// ── Singleton repositories ──────────────────────────────────────────────────

let _sqliteRepos: RepositoryContext | null = null;
let _supabaseRepos: RepositoryContext | null = null;

function getSqliteRepositories(): RepositoryContext {
  if (!_sqliteRepos) {
    _sqliteRepos = {
      projects: new SqliteProjectRepository(),
      cards: new SqliteCardRepository(),
      checklistItems: new SqliteChecklistItemRepository(),
      chatMessages: new SqliteChatMessageRepository(),
      files: new SqliteFileRepository(),
      // users, teams, teamMembers, invites are Supabase-only
    };
  }
  return _sqliteRepos;
}

function getSupabaseRepositories(): RepositoryContext {
  if (!_supabaseRepos) {
    _supabaseRepos = {
      projects: new SupabaseProjectRepository(),
      cards: new SupabaseCardRepository(),
      checklistItems: new SupabaseChecklistItemRepository(),
      chatMessages: new SupabaseChatMessageRepository(),
      files: new SupabaseFileRepository(),
      users: new SupabaseUserRepository(),
      teams: new SupabaseTeamRepository(),
      teamMembers: new SupabaseTeamMemberRepository(),
      invites: new SupabaseInviteRepository(),
    };
  }
  return _supabaseRepos;
}

/**
 * Get repository context for a specific storage mode.
 *
 * @param storageMode - "local" for SQLite, "supabase" for Supabase
 * @returns RepositoryContext with all repository instances
 */
export function getRepositories(storageMode: string = "local"): RepositoryContext {
  switch (storageMode) {
    case "local":
      return getSqliteRepositories();

    case "supabase":
      return getSupabaseRepositories();

    default:
      return getSqliteRepositories();
  }
}

/**
 * Convenience: get repositories using the default local storage.
 * Use this when you don't have a project context (e.g., listing all projects).
 */
export function getLocalRepositories(): RepositoryContext {
  return getSqliteRepositories();
}

// Re-export types
export type {
  RepositoryContext,
  IProjectRepository,
  ICardRepository,
  IChecklistItemRepository,
  IChatMessageRepository,
  IFileRepository,
  IUserRepository,
  ITeamRepository,
  ITeamMemberRepository,
  IInviteRepository,
  ProjectRow,
  CardRow,
  ChecklistItemRow,
  ChatMessageRow,
  FileRow,
  UserRow,
  TeamRow,
  TeamMemberRow,
  InviteRow,
} from "./types";
