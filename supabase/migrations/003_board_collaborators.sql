-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 003: Board-level Collaborator Invites
--
-- Allows inviting collaborators directly to a specific board without
-- requiring team membership. Board roles: viewer, editor, admin.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── STEP 1: Create new tables ─────────────────────────────────────────────────

-- Board collaborators (direct board-level access)
CREATE TABLE IF NOT EXISTS board_collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer', -- 'viewer', 'editor', 'admin'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Board invites (pending board-level invitations)
CREATE TABLE IF NOT EXISTS board_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer', -- 'viewer', 'editor', 'admin'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, email)
);

-- ── STEP 2: Enable RLS ─────────────────────────────────────────────────────────

ALTER TABLE board_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_invites ENABLE ROW LEVEL SECURITY;

-- ── STEP 3: Helper function ────────────────────────────────────────────────────

-- Check if user is a board collaborator with specific roles
CREATE OR REPLACE FUNCTION is_board_collaborator(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM board_collaborators
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_board_role(p_project_id UUID, p_user_id UUID, p_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM board_collaborators
    WHERE project_id = p_project_id AND user_id = p_user_id AND role = ANY(p_roles)
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user can manage board (team owner/admin OR board admin)
CREATE OR REPLACE FUNCTION can_manage_board(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    -- Team owner/admin
    SELECT 1 FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE p.id = p_project_id
      AND tm.user_id = p_user_id
      AND tm.role IN ('owner', 'admin')
  )
  OR EXISTS (
    -- Board admin
    SELECT 1 FROM board_collaborators bc
    WHERE bc.project_id = p_project_id
      AND bc.user_id = p_user_id
      AND bc.role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── STEP 4: Board collaborators policies ────────────────────────────────────────

-- Collaborators can see other collaborators on the same board
CREATE POLICY "Board collaborators can view co-collaborators"
  ON board_collaborators FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM board_collaborators WHERE user_id = auth.uid()
    )
    OR
    project_id IN (
      SELECT id FROM projects WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Board admins and team admins/owners can add collaborators
CREATE POLICY "Admins can add board collaborators"
  ON board_collaborators FOR INSERT
  WITH CHECK (can_manage_board(project_id, auth.uid()));

-- Board admins and team admins/owners can update collaborators
CREATE POLICY "Admins can update board collaborators"
  ON board_collaborators FOR UPDATE
  USING (can_manage_board(project_id, auth.uid()));

-- Board admins and team admins/owners can remove collaborators
CREATE POLICY "Admins can remove board collaborators"
  ON board_collaborators FOR DELETE
  USING (can_manage_board(project_id, auth.uid()));

-- Users can remove themselves
CREATE POLICY "Users can remove themselves as board collaborators"
  ON board_collaborators FOR DELETE
  USING (user_id = auth.uid());

-- ── STEP 5: Board invites policies ──────────────────────────────────────────────

-- Admins can view board invites
CREATE POLICY "Admins can view board invites"
  ON board_invites FOR SELECT
  USING (can_manage_board(project_id, auth.uid()));

-- Invited users can view their own board invites
CREATE POLICY "Invited users can view their own board invites"
  ON board_invites FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Admins can create board invites
CREATE POLICY "Admins can create board invites"
  ON board_invites FOR INSERT
  WITH CHECK (can_manage_board(project_id, auth.uid()));

-- Admins can update board invites
CREATE POLICY "Admins can update board invites"
  ON board_invites FOR UPDATE
  USING (can_manage_board(project_id, auth.uid()));

-- Invited users can update their own board invites (accept/decline)
CREATE POLICY "Invited users can update their own board invites"
  ON board_invites FOR UPDATE
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Admins can delete board invites
CREATE POLICY "Admins can delete board invites"
  ON board_invites FOR DELETE
  USING (can_manage_board(project_id, auth.uid()));

-- ── STEP 6: Update project/card policies to include board collaborators ──────

-- Allow board collaborators to view projects they're invited to
DROP POLICY IF EXISTS "Users can view projects belonging to their teams" ON projects;

CREATE POLICY "Users can view projects via team or board collaboration"
  ON projects FOR SELECT
  USING (
    (team_id IS NOT NULL AND is_team_member(team_id, auth.uid()))
    OR
    is_board_collaborator(id, auth.uid())
  );

-- Allow board collaborators (editor/admin) to update projects
-- Keep existing team-based update policy, add board collaborator policy
DROP POLICY IF EXISTS "Team owners/admins can update projects" ON projects;

CREATE POLICY "Team owners/admins or board admins can update projects"
  ON projects FOR UPDATE
  USING (
    (team_id IS NOT NULL AND has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin']))
    OR
    has_board_role(id, auth.uid(), ARRAY['admin'])
  );

-- Update card policies to include board collaborators
DROP POLICY IF EXISTS "Users can access cards in their team projects" ON cards;

CREATE POLICY "Users can access cards in their team or shared projects"
  ON cards FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
    OR
    project_id IN (
      SELECT project_id FROM board_collaborators WHERE user_id = auth.uid()
    )
  );

-- Update checklist item policies
DROP POLICY IF EXISTS "Users can access checklist items in their team projects" ON checklist_items;

CREATE POLICY "Users can access checklist items in team or shared projects"
  ON checklist_items FOR ALL
  USING (
    card_id IN (
      SELECT id FROM cards WHERE project_id IN (
        SELECT id FROM projects WHERE team_id IN (
          SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
        UNION
        SELECT project_id FROM board_collaborators WHERE user_id = auth.uid()
      )
    )
  );

-- Update chat message policies
DROP POLICY IF EXISTS "Users can access chat messages in their team projects" ON chat_messages;

CREATE POLICY "Users can access chat messages in team or shared projects"
  ON chat_messages FOR ALL
  USING (
    (project_id IS NOT NULL AND project_id IN (
      SELECT id FROM projects WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
      UNION
      SELECT project_id FROM board_collaborators WHERE user_id = auth.uid()
    ))
    OR
    (card_id IS NOT NULL AND card_id IN (
      SELECT id FROM cards WHERE project_id IN (
        SELECT id FROM projects WHERE team_id IN (
          SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
        UNION
        SELECT project_id FROM board_collaborators WHERE user_id = auth.uid()
      )
    ))
  );

-- Update file policies
DROP POLICY IF EXISTS "Users can access files in their team projects" ON files;

CREATE POLICY "Users can access files in team or shared projects"
  ON files FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
      UNION
      SELECT project_id FROM board_collaborators WHERE user_id = auth.uid()
    )
  );

-- ── STEP 7: Create indexes ──────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_board_collaborators_project_id ON board_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_board_collaborators_user_id ON board_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_board_invites_project_id ON board_invites(project_id);
CREATE INDEX IF NOT EXISTS idx_board_invites_email ON board_invites(email);
CREATE INDEX IF NOT EXISTS idx_board_invites_status ON board_invites(status);
