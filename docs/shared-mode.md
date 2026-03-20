# Shared Mode: Remote Deployment & Multi-User Setup

## Architecture Overview

In shared mode, each developer runs the full Trellai stack locally. A shared Supabase database and Supabase Realtime handle cross-machine synchronization. Claude Code agents run on each developer's machine.

```
 Developer A's Machine              Developer B's Machine
┌──────────────────────┐           ┌──────────────────────┐
│  Trellai (npm run dev)│          │  Trellai (npm run dev)│
│  ┌────────┐ ┌───────┐│          │  ┌────────┐ ┌───────┐│
│  │Next.js │ │Socket │││          │  │Next.js │ │Socket │││
│  │  :3000 │ │IO:3001│││          │  │  :3000 │ │IO:3001│││
│  └────┬───┘ └───────┘││          │  └────┬───┘ └───────┘││
│       │    ┌─────────┐│          │       │    ┌─────────┐│
│       │    │Claude   ││          │       │    │Claude   ││
│       │    │Process  ││          │       │    │Process  ││
│       │    └─────────┘│          │       │    └─────────┘│
│       │    ┌─────────┐│          │       │    ┌─────────┐│
│       │    │Git Repo ││          │       │    │Git Repo ││
│       │    │(local)  ││          │       │    │(local)  ││
│       │    └─────────┘│          │       │    └─────────┘│
└───────┼──────────────-┘          └───────┼──────────────-┘
        │    Supabase Realtime             │
        │    (Broadcast channels)          │
        ▼                                  ▼
   ┌─────────────────────────────────────────┐
   │         Supabase (shared)               │
   │  ┌──────────┐  ┌───────────────────┐    │
   │  │ Postgres │  │ Realtime Broadcast│    │
   │  │ (DB)     │  │ (sync events)     │    │
   │  └──────────┘  └───────────────────┘    │
   └─────────────────────────────────────────┘
```

## Prerequisites

1. **Supabase project** — Create one at [supabase.com](https://supabase.com)
2. **Git** installed locally
3. **Claude Code** CLI installed (`npm install -g @anthropic-ai/claude-code`)
4. **Node.js 20+**

## Setup Steps

### 1. Supabase Database

Create the following tables in your Supabase project (SQL Editor):

```sql
-- Projects table
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  repo_path TEXT NOT NULL,
  repo_url TEXT,
  chat_session_id TEXT,
  mode TEXT NOT NULL DEFAULT 'worktree',
  storage_mode TEXT NOT NULL DEFAULT 'supabase',
  user_id TEXT,
  team_id TEXT,
  created_at TEXT NOT NULL
);

-- Cards table
CREATE TABLE cards (
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
  assigned_to TEXT,
  commit_sha TEXT,
  test_status TEXT,
  test_results TEXT,
  is_icebox INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Chat messages
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  "column" TEXT NOT NULL,
  message_type TEXT,
  created_at TEXT NOT NULL
);

-- Checklist items
CREATE TABLE checklist_items (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Files
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL
);

-- Teams
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_personal BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL
);

-- Team members
CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL
);

-- Invites
CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### 2. Enable Supabase Realtime

In your Supabase dashboard:
1. Go to **Database → Replication**
2. Enable Realtime for the `cards`, `projects`, and `chat_messages` tables
3. Go to **Settings → API** and note your project URL and anon key

### 3. Environment Configuration

Each developer creates a `.env.local` file:

```bash
# Auth
AUTH_SECRET=<shared-secret-across-team>
AUTH_TRUST_HOST=true

# Supabase (shared across team)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Socket.IO (local, no change needed)
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
SOCKET_URL=http://localhost:3001

# Workspace for auto-cloned repos (optional, defaults to ~/.trellai/workspaces)
# TRELLAI_WORKSPACE_DIR=~/code/trellai-workspaces
```

### 4. Running Locally

```bash
# Install dependencies
npm install

# Start both Next.js and Socket.IO
npm run dev:all
```

Open `http://localhost:3000` in your browser.

## Daily Workflow

### Creating a Shared Project

1. Click **New Board** on the dashboard
2. Enter a **Project Name**
3. Enter either:
   - A **local path** (e.g., `/Users/you/code/my-project`) — for repos already cloned
   - A **GitHub URL** (e.g., `https://github.com/org/repo`) — Trellai will auto-clone it to `~/.trellai/workspaces/`
4. Assign the project to a **team** if desired

### Card Assignment

In shared mode, cards should be assigned to specific team members:
1. Open a card
2. Use the assign endpoint: `POST /api/cards/:id/assign { assignedTo: userId }`
3. Only the assigned developer's local agent will pick up the card

### Development Flow

1. **Plan**: Drag card to Planning column, discuss with the AI agent
2. **Develop**: Move card to Production — the assigned dev's local Claude agent implements the feature
3. **Review**: Move to Review — view the diff
4. **Merge**: Approve to merge the branch. In shared mode, the merge is also pushed to the remote

### Real-Time Sync

- **Board state** syncs via shared Supabase database
- **Live events** (agent output, status changes) broadcast via Supabase Realtime
- **Presence** (who's viewing what) works via local Socket.IO + Supabase Realtime

## Docker Deployment (Optional)

For running Trellai as a shared server (instead of each dev running locally):

```bash
# Build the image
docker build -t trellai .

# Or use docker-compose
docker compose up -d
```

Configure environment variables in `docker-compose.yml` or via `.env` file.

### Environment Variables for Docker

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_SECRET` | Auth.js secret key | Required |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Required |
| `NEXT_PUBLIC_SOCKET_URL` | Public Socket.IO URL | `http://localhost:3001` |
| `SOCKET_URL` | Internal Socket.IO URL | `http://localhost:3001` |
| `SOCKET_PORT` | Socket.IO port | `3001` |
| `SOCKET_CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `*` |
| `TRELLAI_WORKSPACE_DIR` | Directory for auto-cloned repos | `~/.trellai/workspaces` |

## Troubleshooting

### "Repository path does not exist"
- Ensure the local path exists, or use a GitHub URL for auto-clone
- Check that `TRELLAI_WORKSPACE_DIR` is writable

### Socket.IO connection issues
- Verify `NEXT_PUBLIC_SOCKET_URL` matches where your Socket.IO server is running
- Check CORS settings if accessing from a different origin

### Git push/pull failures
- Ensure SSH keys or HTTPS credentials are configured for the remote repo
- For GitHub URLs, use HTTPS with a personal access token or SSH

### Supabase Realtime not syncing
- Verify Realtime is enabled for your tables in Supabase dashboard
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
