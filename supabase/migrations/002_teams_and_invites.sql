-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 002: Teams, Invites, and Personal Teams Pattern
--
-- Replaces the owner_id + project_members model with a team-based ownership
-- model. Every user auto-gets a personal team on signup. All projects belong
-- to a team.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── STEP 1: Create new tables ─────────────────────────────────────────────────

-- Users table (synced from Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_personal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Team members (join table)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Invites table
CREATE TABLE IF NOT EXISTS invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'admin', 'member'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, email)
);

-- ── STEP 2: Migrate projects table ───────────────────────────────────────────

-- Add team_id column to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

-- Migrate existing projects: create personal teams for current owners
-- For each distinct owner_id, create a personal team and assign the project
DO $$
DECLARE
  r RECORD;
  new_team_id UUID;
  existing_user RECORD;
BEGIN
  FOR r IN SELECT DISTINCT owner_id FROM projects WHERE owner_id IS NOT NULL AND team_id IS NULL
  LOOP
    -- Check if user already has a personal team
    SELECT tm.team_id INTO new_team_id
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.user_id = r.owner_id AND t.is_personal = TRUE
    LIMIT 1;

    IF new_team_id IS NULL THEN
      -- Create personal team
      INSERT INTO teams (name, is_personal) VALUES ('Personal', TRUE) RETURNING id INTO new_team_id;
      -- Add owner as team owner
      INSERT INTO team_members (team_id, user_id, role) VALUES (new_team_id, r.owner_id, 'owner');

      -- Sync user to users table if not already there
      SELECT id INTO existing_user FROM users WHERE id = r.owner_id;
      IF existing_user IS NULL THEN
        INSERT INTO users (id, email, name)
        SELECT id, COALESCE(email, raw_user_meta_data->>'email', 'unknown'),
               COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name')
        FROM auth.users WHERE id = r.owner_id
        ON CONFLICT (id) DO NOTHING;
      END IF;
    END IF;

    -- Assign projects to personal team
    UPDATE projects SET team_id = new_team_id WHERE owner_id = r.owner_id AND team_id IS NULL;
  END LOOP;
END $$;

-- Migrate project_members to team_members
DO $$
DECLARE
  r RECORD;
  proj_team_id UUID;
BEGIN
  FOR r IN SELECT DISTINCT pm.project_id, pm.user_id, pm.role
           FROM project_members pm
           WHERE NOT EXISTS (
             SELECT 1 FROM team_members tm
             JOIN projects p ON p.team_id = tm.team_id
             WHERE p.id = pm.project_id AND tm.user_id = pm.user_id
           )
  LOOP
    SELECT team_id INTO proj_team_id FROM projects WHERE id = r.project_id;
    IF proj_team_id IS NOT NULL THEN
      INSERT INTO team_members (team_id, user_id, role)
      VALUES (proj_team_id, r.user_id, r.role)
      ON CONFLICT (team_id, user_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ── STEP 3: Drop old tables/columns ──────────────────────────────────────────

-- Drop old project_members table (replaced by team_members)
DROP TABLE IF EXISTS project_members;

-- We keep owner_id for backward compatibility but it's no longer authoritative.
-- New queries should use team_id + team_members.

-- ── STEP 4: Enable RLS on new tables ─────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- ── STEP 5: Drop old RLS policies and create new ones ─────────────────────────

-- Helper function: check if user is a member of a team
CREATE OR REPLACE FUNCTION is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function: check if user has a specific role in a team
CREATE OR REPLACE FUNCTION has_team_role(p_team_id UUID, p_user_id UUID, p_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id AND user_id = p_user_id AND role = ANY(p_roles)
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── Users policies ──

CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can view teammates"
  ON users FOR SELECT
  USING (
    id IN (
      SELECT tm.user_id FROM team_members tm
      WHERE tm.team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- ── Teams policies ──

CREATE POLICY "Users can view teams they belong to"
  ON teams FOR SELECT
  USING (is_team_member(id, auth.uid()));

CREATE POLICY "Authenticated users can create teams"
  ON teams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team owners/admins can update their teams"
  ON teams FOR UPDATE
  USING (has_team_role(id, auth.uid(), ARRAY['owner', 'admin']));

CREATE POLICY "Team owners can delete their teams"
  ON teams FOR DELETE
  USING (has_team_role(id, auth.uid(), ARRAY['owner']));

-- ── Team members policies ──

CREATE POLICY "Users can view members of their teams"
  ON team_members FOR SELECT
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Team owners/admins can manage members"
  ON team_members FOR INSERT
  WITH CHECK (has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin']));

CREATE POLICY "Team owners/admins can update members"
  ON team_members FOR UPDATE
  USING (has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin']));

CREATE POLICY "Team owners/admins can remove members"
  ON team_members FOR DELETE
  USING (has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin']));

-- Allow users to leave teams themselves
CREATE POLICY "Users can remove themselves from teams"
  ON team_members FOR DELETE
  USING (user_id = auth.uid());

-- ── Invites policies ──

CREATE POLICY "Team owners/admins can view invites"
  ON invites FOR SELECT
  USING (has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin']));

CREATE POLICY "Invited users can view their own invites"
  ON invites FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Team owners/admins can create invites"
  ON invites FOR INSERT
  WITH CHECK (has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin']));

CREATE POLICY "Team owners/admins can update invites"
  ON invites FOR UPDATE
  USING (has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin']));

CREATE POLICY "Invited users can update their own invites"
  ON invites FOR UPDATE
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Team owners/admins can delete invites"
  ON invites FOR DELETE
  USING (has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin']));

-- ── Update project policies (drop old, create new team-based) ──

DROP POLICY IF EXISTS "Users can view projects they own or are members of" ON projects;
DROP POLICY IF EXISTS "Users can insert their own projects" ON projects;
DROP POLICY IF EXISTS "Owners can update their projects" ON projects;
DROP POLICY IF EXISTS "Owners can delete their projects" ON projects;

CREATE POLICY "Users can view projects belonging to their teams"
  ON projects FOR SELECT
  USING (
    team_id IS NOT NULL AND is_team_member(team_id, auth.uid())
  );

CREATE POLICY "Team members can create projects in their teams"
  ON projects FOR INSERT
  WITH CHECK (
    team_id IS NOT NULL AND is_team_member(team_id, auth.uid())
  );

CREATE POLICY "Team owners/admins can update projects"
  ON projects FOR UPDATE
  USING (
    team_id IS NOT NULL AND has_team_role(team_id, auth.uid(), ARRAY['owner', 'admin'])
  );

CREATE POLICY "Team owners can delete projects"
  ON projects FOR DELETE
  USING (
    team_id IS NOT NULL AND has_team_role(team_id, auth.uid(), ARRAY['owner'])
  );

-- ── Update card policies ──

DROP POLICY IF EXISTS "Users can access cards in their projects" ON cards;

CREATE POLICY "Users can access cards in their team projects"
  ON cards FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

-- ── Update checklist item policies ──

DROP POLICY IF EXISTS "Users can access checklist items in their projects" ON checklist_items;

CREATE POLICY "Users can access checklist items in their team projects"
  ON checklist_items FOR ALL
  USING (
    card_id IN (
      SELECT id FROM cards WHERE project_id IN (
        SELECT id FROM projects WHERE team_id IN (
          SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
      )
    )
  );

-- ── Update chat message policies ──

DROP POLICY IF EXISTS "Users can access chat messages in their projects" ON chat_messages;

CREATE POLICY "Users can access chat messages in their team projects"
  ON chat_messages FOR ALL
  USING (
    (project_id IS NOT NULL AND project_id IN (
      SELECT id FROM projects WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    ))
    OR
    (card_id IS NOT NULL AND card_id IN (
      SELECT id FROM cards WHERE project_id IN (
        SELECT id FROM projects WHERE team_id IN (
          SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
      )
    ))
  );

-- ── Update file policies ──

DROP POLICY IF EXISTS "Users can access files in their projects" ON files;

CREATE POLICY "Users can access files in their team projects"
  ON files FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

-- ── Drop old project_members policies ──

DROP POLICY IF EXISTS "Members can view their own memberships" ON project_members;
DROP POLICY IF EXISTS "Owners can manage members" ON project_members;

-- ── STEP 6: Create indexes ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_invites_team_id ON invites(team_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status);
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ── STEP 7: Create trigger for auto-personal-team on signup ───────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_team_id UUID;
BEGIN
  -- Sync to users table
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', 'unknown'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url;

  -- Create personal team
  INSERT INTO public.teams (name, is_personal) VALUES ('Personal', TRUE) RETURNING id INTO new_team_id;

  -- Add user as team owner
  INSERT INTO public.team_members (team_id, user_id, role) VALUES (new_team_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
