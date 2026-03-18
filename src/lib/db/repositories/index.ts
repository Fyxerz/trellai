/**
 * Repository factory — returns the correct repository implementation
 * based on the project's storage mode.
 *
 * Phase 1: Always returns SQLite repositories.
 * Phase 2: Will add Supabase repositories and route based on storageMode.
 */

import type { RepositoryContext } from "./types";
import {
  SqliteProjectRepository,
  SqliteCardRepository,
  SqliteChecklistItemRepository,
  SqliteChatMessageRepository,
  SqliteFileRepository,
} from "./sqlite";

// ── Singleton SQLite repositories ───────────────────────────────────────────

let _sqliteRepos: RepositoryContext | null = null;

function getSqliteRepositories(): RepositoryContext {
  if (!_sqliteRepos) {
    _sqliteRepos = {
      projects: new SqliteProjectRepository(),
      cards: new SqliteCardRepository(),
      checklistItems: new SqliteChecklistItemRepository(),
      chatMessages: new SqliteChatMessageRepository(),
      files: new SqliteFileRepository(),
    };
  }
  return _sqliteRepos;
}

/**
 * Get repository context for a specific storage mode.
 *
 * @param storageMode - "local" for SQLite, "supabase" for Supabase (Phase 2)
 * @returns RepositoryContext with all repository instances
 */
export function getRepositories(storageMode: string = "local"): RepositoryContext {
  switch (storageMode) {
    case "local":
      return getSqliteRepositories();

    case "supabase":
      // Phase 2: Will return Supabase repositories
      throw new Error("Supabase storage mode is not yet implemented. Coming in Phase 2.");

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
  ProjectRow,
  CardRow,
  ChecklistItemRow,
  ChatMessageRow,
  FileRow,
} from "./types";
