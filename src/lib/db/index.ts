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

// Migrate: add message_type column to chat_messages for verbose agent output
try {
  sqlite.exec(`ALTER TABLE chat_messages ADD COLUMN message_type TEXT`);
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
