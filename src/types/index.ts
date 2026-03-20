export type Column = "features" | "planning" | "production" | "review" | "complete";

export type CardType = "feature" | "fix";

export type AgentStatus = "idle" | "running" | "awaiting_feedback" | "ready_for_dev" | "dev_complete" | "error" | "complete" | "merged" | "queued" | "reverted";

export type TestStatus = "passed" | "failed" | "partial" | "no_tests" | null;

export interface TestResult {
  name: string;
  status: "passed" | "failed" | "skipped";
  error?: string;
}

export interface TestResults {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  tests: TestResult[];
}

export type StorageMode = "local" | "supabase";

export interface Project {
  id: string;
  name: string;
  repoPath: string;
  chatSessionId: string | null;
  mode: "worktree" | "queue";
  storageMode: StorageMode;
  teamId: string | null;
  createdAt: string;
}

export type TeamMemberRole = "owner" | "admin" | "member";
export type InviteStatus = "pending" | "accepted" | "declined" | "expired";

export interface Team {
  id: string;
  name: string;
  isPersonal: boolean;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamMemberRole;
  createdAt: string;
}

export interface Invite {
  id: string;
  teamId: string;
  email: string;
  role: TeamMemberRole;
  status: InviteStatus;
  invitedBy: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Card {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: CardType;
  column: Column;
  position: number;
  branchName: string | null;
  worktreePath: string | null;
  claudeSessionId: string | null;
  agentStatus: AgentStatus;
  commitSha: string | null;
  testStatus: TestStatus;
  testResults: TestResults | null;
  createdAt: string;
  updatedAt: string;
  checklistTotal?: number;
  checklistChecked?: number;
}

export interface ChecklistItem {
  id: string;
  cardId: string;
  text: string;
  checked: boolean;
  position: number;
  createdAt: string;
}

export type ChatSegment =
  | { kind: "text"; content: string }
  | { kind: "thinking"; content: string }
  | { kind: "tool_use"; toolName: string; input: string }
  | { kind: "tool_result"; toolName: string; content: string }
  | { kind: "tools_compact"; tools: { name: string; count: number }[] };

export interface ChatMessage {
  id: string;
  cardId: string | null;
  projectId?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  column: Column | "project";
  messageType?: string | null;
  segments?: ChatSegment[];
  createdAt: string;
}

export interface FileAttachment {
  id: string;
  projectId: string;
  cardId: string | null;
  filename: string;
  storedPath: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface AgentOutput {
  type: "text" | "tool_use" | "tool_input" | "tool_result" | "tool_summary" | "tool_progress" | "thinking" | "status" | "error" | "result" | "system";
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  timestamp: string;
}

export interface BoardState {
  project: Project | null;
  cards: Card[];
}

// Re-export UserIdentity from identity module for convenience
export type { UserIdentity } from "@/lib/identity";

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
}

export interface CardLock {
  userId: string;
  userName: string;
  userColor: string;
  lockedAt: number; // timestamp
}
