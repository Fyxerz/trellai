/**
 * Repository factory — returns the correct repository implementation
 * based on the project's storage mode.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RepositoryContext } from "./types";
import {
  SqliteProjectRepository,
  SqliteCardRepository,
  SqliteChecklistItemRepository,
  SqliteChatMessageRepository,
  SqliteChatConversationRepository,
  SqliteFileRepository,
  SqliteUserRepository,
  SqliteTeamRepository,
  SqliteTeamMemberRepository,
  SqliteInviteRepository,
  SqliteBoardCollaboratorRepository,
  SqliteBoardInviteRepository,
} from "./sqlite";
import {
  SupabaseProjectRepository,
  SupabaseCardRepository,
  SupabaseChecklistItemRepository,
  SupabaseChatMessageRepository,
  SupabaseChatConversationRepository,
  SupabaseFileRepository,
  SupabaseUserRepository,
  SupabaseTeamRepository,
  SupabaseTeamMemberRepository,
  SupabaseInviteRepository,
  SupabaseBoardCollaboratorRepository,
  SupabaseBoardInviteRepository,
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
      chatConversations: new SqliteChatConversationRepository(),
      files: new SqliteFileRepository(),
      users: new SqliteUserRepository(),
      teams: new SqliteTeamRepository(),
      teamMembers: new SqliteTeamMemberRepository(),
      invites: new SqliteInviteRepository(),
      boardCollaborators: new SqliteBoardCollaboratorRepository(),
      boardInvites: new SqliteBoardInviteRepository(),
    };
  }
  return _sqliteRepos;
}

/**
 * Build Supabase repositories using the given client.
 *
 * When `client` is provided (e.g., the cookie-aware server client from
 * `createServerSupabaseClient()`), every repository uses that authenticated
 * client so RLS policies see `auth.uid()`.
 *
 * When `client` is omitted, repositories fall back to the anon-key singleton
 * (`getSupabaseClient()`), which is useful for contexts without a request
 * (e.g., orchestrator, socket server).
 */
function buildSupabaseRepositories(client?: SupabaseClient): RepositoryContext {
  return {
    projects: new SupabaseProjectRepository(client),
    cards: new SupabaseCardRepository(client),
    checklistItems: new SupabaseChecklistItemRepository(client),
    chatMessages: new SupabaseChatMessageRepository(client),
    chatConversations: new SupabaseChatConversationRepository(client),
    files: new SupabaseFileRepository(client),
    users: new SupabaseUserRepository(client),
    teams: new SupabaseTeamRepository(client),
    teamMembers: new SupabaseTeamMemberRepository(client),
    invites: new SupabaseInviteRepository(client),
    boardCollaborators: new SupabaseBoardCollaboratorRepository(client),
    boardInvites: new SupabaseBoardInviteRepository(client),
  };
}

function getSupabaseRepositories(): RepositoryContext {
  if (!_supabaseRepos) {
    _supabaseRepos = buildSupabaseRepositories();
  }
  return _supabaseRepos;
}

/**
 * Get repository context for a specific storage mode.
 *
 * @param storageMode - "local" for SQLite, "supabase" for Supabase
 * @param client - Optional Supabase client to inject into repositories.
 *   When provided (and storageMode is "supabase"), repositories use this
 *   authenticated client instead of the anon-key singleton, ensuring RLS
 *   policies see the correct `auth.uid()`. Pass the result of
 *   `createServerSupabaseClient()` from API route handlers.
 * @returns RepositoryContext with all repository instances
 */
export function getRepositories(storageMode: string = "local", client?: SupabaseClient): RepositoryContext {
  switch (storageMode) {
    case "local":
      return getSqliteRepositories();

    case "supabase":
      // When a client is injected, build fresh per-request repos (no caching).
      // Without a client, return the cached singleton for backward compat.
      return client ? buildSupabaseRepositories(client) : getSupabaseRepositories();

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
  IChatConversationRepository,
  IFileRepository,
  IUserRepository,
  ITeamRepository,
  ITeamMemberRepository,
  IInviteRepository,
  IBoardCollaboratorRepository,
  IBoardInviteRepository,
  ProjectRow,
  CardRow,
  ChecklistItemRow,
  ChatMessageRow,
  ChatConversationRow,
  FileRow,
  UserRow,
  TeamRow,
  TeamMemberRow,
  InviteRow,
  BoardCollaboratorRow,
  BoardInviteRow,
  BoardRole,
} from "./types";
