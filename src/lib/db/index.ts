import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "trellai.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Auto-create tables on first import
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    repo_path TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'feature',
    column TEXT NOT NULL DEFAULT 'features',
    position INTEGER NOT NULL DEFAULT 0,
    branch_name TEXT,
    worktree_path TEXT,
    claude_session_id TEXT,
    agent_status TEXT NOT NULL DEFAULT 'idle',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS checklist_items (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    card_id TEXT REFERENCES cards(id),
    project_id TEXT REFERENCES projects(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    column TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Migrate: add type column to existing cards table
try {
  sqlite.exec(`ALTER TABLE cards ADD COLUMN type TEXT NOT NULL DEFAULT 'feature'`);
} catch {
  // Column already exists
}
// Backfill any NULL type values from before migration
sqlite.exec(`UPDATE cards SET type = 'feature' WHERE type IS NULL`);

// Migrate: make card_id nullable and ensure project_id exists in chat_messages.
// SQLite doesn't support ALTER COLUMN, so we recreate the table.
try {
  const cols = sqlite.prepare("PRAGMA table_info(chat_messages)").all() as { name: string; notnull: number }[];
  const cardIdCol = cols.find((c) => c.name === "card_id");
  const needsRecreate = cardIdCol && cardIdCol.notnull === 1;

  if (needsRecreate) {
    sqlite.pragma("foreign_keys = OFF");
    sqlite.exec(`
      CREATE TABLE chat_messages_new (
        id TEXT PRIMARY KEY,
        card_id TEXT REFERENCES cards(id),
        project_id TEXT REFERENCES projects(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        "column" TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      INSERT INTO chat_messages_new (id, card_id, project_id, role, content, "column", created_at)
        SELECT id, card_id, project_id, role, content, "column", created_at FROM chat_messages;

      DROP TABLE chat_messages;
      ALTER TABLE chat_messages_new RENAME TO chat_messages;
    `);
    sqlite.pragma("foreign_keys = ON");
  }
} catch (e) {
  console.error("[db] chat_messages migration error:", e);
}

// Migrate: add chat_session_id column to projects
try {
  sqlite.exec(`ALTER TABLE projects ADD COLUMN chat_session_id TEXT`);
} catch {
  // Column already exists
}

// Migrate: add mode column to projects (queue mode support)
try {
  sqlite.exec(`ALTER TABLE projects ADD COLUMN mode TEXT NOT NULL DEFAULT 'worktree'`);
} catch {
  // Column already exists
}

// Migrate: add commit_sha column to cards (queue mode support)
try {
  sqlite.exec(`ALTER TABLE cards ADD COLUMN commit_sha TEXT`);
} catch {
  // Column already exists
}

// Migrate: add test_status and test_results columns to cards
try {
  sqlite.exec(`ALTER TABLE cards ADD COLUMN test_status TEXT`);
} catch {
  // Column already exists
}
try {
  sqlite.exec(`ALTER TABLE cards ADD COLUMN test_results TEXT`);
} catch {
  // Column already exists
}

// Migrate: add message_type column to chat_messages for verbose agent output
try {
  sqlite.exec(`ALTER TABLE chat_messages ADD COLUMN message_type TEXT`);
} catch {
  // Column already exists
}

// Migrate: add storage_mode column to projects (local vs supabase)
try {
  sqlite.exec(`ALTER TABLE projects ADD COLUMN storage_mode TEXT NOT NULL DEFAULT 'local'`);
} catch {
  // Column already exists
}

// Migrate: create files table for user uploads
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Migrate: add user_id column to projects (multi-tenancy)
try {
  sqlite.exec(`ALTER TABLE projects ADD COLUMN user_id TEXT`);
} catch {
  // Column already exists
}

// Migrate: add team_id column to projects (team ownership)
try {
  sqlite.exec(`ALTER TABLE projects ADD COLUMN team_id TEXT`);
} catch {
  // Column already exists
}

// Migrate: create/update users, teams, team_members, invites tables (team management)
// The users table may already exist with a different schema (e.g., password_hash, NOT NULL name).
// We recreate it to match the Supabase-based auth model (no password_hash, nullable name).
try {
  const usersInfo = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as { sql: string } | undefined;
  if (usersInfo?.sql && usersInfo.sql.includes("password_hash")) {
    sqlite.pragma("foreign_keys = OFF");
    sqlite.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT,
        avatar_url TEXT,
        created_at TEXT NOT NULL
      );
      INSERT OR IGNORE INTO users_new (id, email, name, avatar_url, created_at)
        SELECT id, email, name, avatar_url, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
    sqlite.pragma("foreign_keys = ON");
  } else if (!usersInfo) {
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT,
        avatar_url TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }
} catch (e) {
  console.error("[db] users migration error:", e);
}

// Migrate: teams table — may have old schema (created_by instead of is_personal)
try {
  const teamsInfo = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='teams'").get() as { sql: string } | undefined;
  if (teamsInfo?.sql && !teamsInfo.sql.includes("is_personal")) {
    sqlite.pragma("foreign_keys = OFF");
    sqlite.exec(`
      CREATE TABLE teams_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        is_personal INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      INSERT OR IGNORE INTO teams_new (id, name, is_personal, created_at)
        SELECT id, name, 0, created_at FROM teams;
      DROP TABLE teams;
      ALTER TABLE teams_new RENAME TO teams;
    `);
    sqlite.pragma("foreign_keys = ON");
  } else if (!teamsInfo) {
    sqlite.exec(`
      CREATE TABLE teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        is_personal INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);
  }
} catch (e) {
  console.error("[db] teams migration error:", e);
}

// Migrate: team_members table — may have joined_at instead of created_at
try {
  const tmInfo = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='team_members'").get() as { sql: string } | undefined;
  if (tmInfo?.sql && tmInfo.sql.includes("joined_at")) {
    sqlite.pragma("foreign_keys = OFF");
    sqlite.exec(`
      CREATE TABLE team_members_new (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member',
        created_at TEXT NOT NULL
      );
      INSERT OR IGNORE INTO team_members_new (id, team_id, user_id, role, created_at)
        SELECT id, team_id, user_id, role, joined_at FROM team_members;
      DROP TABLE team_members;
      ALTER TABLE team_members_new RENAME TO team_members;
    `);
    sqlite.pragma("foreign_keys = ON");
  } else if (!tmInfo) {
    sqlite.exec(`
      CREATE TABLE team_members (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member',
        created_at TEXT NOT NULL
      );
    `);
  }
} catch (e) {
  console.error("[db] team_members migration error:", e);
}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'pending',
    invited_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Migrate: remove stale FK constraints on user_id/team_id in projects
// These may reference Supabase-only tables (users, teams) that don't exist in SQLite.
try {
  const tableInfo = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'").get() as { sql: string } | undefined;
  if (tableInfo?.sql && (tableInfo.sql.includes("REFERENCES users") || tableInfo.sql.includes("REFERENCES teams"))) {
    sqlite.pragma("foreign_keys = OFF");
    sqlite.exec(`
      CREATE TABLE projects_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        repo_path TEXT NOT NULL,
        chat_session_id TEXT,
        mode TEXT NOT NULL DEFAULT 'worktree',
        storage_mode TEXT NOT NULL DEFAULT 'local',
        user_id TEXT,
        team_id TEXT,
        created_at TEXT NOT NULL
      );
      INSERT INTO projects_new SELECT id, name, repo_path, chat_session_id, mode, storage_mode, user_id, team_id, created_at FROM projects;
      DROP TABLE projects;
      ALTER TABLE projects_new RENAME TO projects;
    `);
    sqlite.pragma("foreign_keys = ON");
  }
} catch (e) {
  console.error("[db] projects FK cleanup error:", e);
}
