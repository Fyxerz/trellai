export type Column = "features" | "production" | "review" | "complete";

export type CardType = "feature" | "fix";

export type AgentStatus = "idle" | "running" | "awaiting_feedback" | "ready_for_dev" | "dev_complete" | "error" | "complete" | "merged" | "queued" | "reverted";

export interface Project {
  id: string;
  name: string;
  repoPath: string;
  chatSessionId: string | null;
  mode: "worktree" | "queue";
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

export interface ChatMessage {
  id: string;
  cardId: string | null;
  projectId?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  column: Column | "project";
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
  type: "text" | "tool_use" | "tool_result" | "status" | "error" | "result";
  content: string;
  timestamp: string;
}

export interface BoardState {
  project: Project | null;
  cards: Card[];
}
