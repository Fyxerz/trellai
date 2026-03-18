-- Supabase schema for Trellai
-- This mirrors the local SQLite schema for public/shared boards.

-- gen_random_uuid() is built into PostgreSQL 13+ (used by Supabase)

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Create all tables
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Projects ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  repo_path TEXT NOT NULL,
  chat_session_id TEXT,
  mode TEXT NOT NULL DEFAULT 'worktree',
  storage_mode TEXT NOT NULL DEFAULT 'supabase',
  owner_id UUID REFERENCES auth.users(id),
  created_at TEXT NOT NULL
);

-- ── Project Members (for collaboration) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor', -- 'owner', 'editor', 'viewer'
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- ── Cards ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'feature',
  "column" TEXT NOT NULL DEFAULT 'features',
  position INTEGER NOT NULL DEFAULT 0,
  branch_name TEXT,
  worktree_path TEXT,
  claude_session_id TEXT,
  agent_status TEXT NOT NULL DEFAULT 'idle',
  commit_sha TEXT,
  test_status TEXT,
  test_results TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ── Checklist Items ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS checklist_items (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ── Chat Messages ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  "column" TEXT NOT NULL,
  message_type TEXT,
  created_at TEXT NOT NULL
);

-- ── Files ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  stored_path TEXT NOT NULL, -- Will be Supabase Storage path for public boards
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Enable RLS on all tables
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Create RLS policies
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Project policies ────────────────────────────────────────────────────────

CREATE POLICY "Users can view projects they own or are members of"
  ON projects FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own projects"
  ON projects FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their projects"
  ON projects FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their projects"
  ON projects FOR DELETE
  USING (owner_id = auth.uid());

-- ── Project member policies ─────────────────────────────────────────────────

CREATE POLICY "Members can view their own memberships"
  ON project_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Owners can manage members"
  ON project_members FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- ── Card policies ───────────────────────────────────────────────────────────

CREATE POLICY "Users can access cards in their projects"
  ON cards FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- ── Checklist item policies ─────────────────────────────────────────────────

CREATE POLICY "Users can access checklist items in their projects"
  ON checklist_items FOR ALL
  USING (
    card_id IN (
      SELECT id FROM cards WHERE project_id IN (
        SELECT id FROM projects WHERE owner_id = auth.uid()
        UNION
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  );

-- ── Chat message policies ───────────────────────────────────────────────────

CREATE POLICY "Users can access chat messages in their projects"
  ON chat_messages FOR ALL
  USING (
    (project_id IS NOT NULL AND project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    ))
    OR
    (card_id IS NOT NULL AND card_id IN (
      SELECT id FROM cards WHERE project_id IN (
        SELECT id FROM projects WHERE owner_id = auth.uid()
        UNION
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    ))
  );

-- ── File policies ───────────────────────────────────────────────────────────

CREATE POLICY "Users can access files in their projects"
  ON files FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 4: Create indexes
-- ══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_cards_project_id ON cards(project_id);
CREATE INDEX IF NOT EXISTS idx_cards_column ON cards("column");
CREATE INDEX IF NOT EXISTS idx_cards_agent_status ON cards(agent_status);
CREATE INDEX IF NOT EXISTS idx_checklist_items_card_id ON checklist_items(card_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_card_id ON chat_messages(card_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_id ON chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_card_id ON files(card_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
