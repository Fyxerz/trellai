/**
 * Repository interfaces for the Trellai data layer.
 *
 * These abstract all database access so we can swap between
 * SQLite (local/private boards) and Supabase (public/shared boards).
 */

// ── Row types ───────────────────────────────────────────────────────────────

export interface ProjectRow {
  id: string;
  name: string;
  repoPath: string;
  chatSessionId: string | null;
  mode: string;
  storageMode: string;
  createdAt: string;
}

export interface CardRow {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: string;
  column: string;
  position: number;
  branchName: string | null;
  worktreePath: string | null;
  claudeSessionId: string | null;
  agentStatus: string;
  commitSha: string | null;
  testStatus: string | null;
  testResults: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItemRow {
  id: string;
  cardId: string;
  text: string;
  checked: boolean;
  position: number;
  createdAt: string;
}

export interface ChatMessageRow {
  id: string;
  cardId: string | null;
  projectId: string | null;
  role: string;
  content: string;
  column: string;
  messageType: string | null;
  createdAt: string;
}

export interface FileRow {
  id: string;
  projectId: string;
  cardId: string | null;
  filename: string;
  storedPath: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

// ── Repository interfaces ───────────────────────────────────────────────────

export interface IProjectRepository {
  findAll(): ProjectRow[];
  findById(id: string): ProjectRow | undefined;
  create(data: Omit<ProjectRow, "chatSessionId" | "storageMode"> & { storageMode?: string }): void;
  update(id: string, data: Partial<Pick<ProjectRow, "name" | "mode" | "chatSessionId" | "storageMode">>): void;
  delete(id: string): void;
}

export interface ICardRepository {
  findAll(): CardRow[];
  findById(id: string): CardRow | undefined;
  findByProjectId(projectId: string): CardRow[];
  findByConditions(conditions: {
    projectId?: string;
    column?: string | string[];
    agentStatus?: string;
    notId?: string;
  }): CardRow[];
  create(data: Omit<CardRow, "branchName" | "worktreePath" | "claudeSessionId" | "commitSha" | "testStatus" | "testResults"> & {
    branchName?: string | null;
    worktreePath?: string | null;
    claudeSessionId?: string | null;
    commitSha?: string | null;
    testStatus?: string | null;
    testResults?: string | null;
  }): void;
  update(id: string, data: Partial<Omit<CardRow, "id">>): void;
  delete(id: string): void;
}

export interface IChecklistItemRepository {
  findByCardId(cardId: string): ChecklistItemRow[];
  findById(id: string): ChecklistItemRow | undefined;
  create(data: ChecklistItemRow): void;
  update(id: string, cardId: string, data: Partial<Pick<ChecklistItemRow, "text" | "checked" | "position">>): void;
  delete(id: string, cardId: string): void;
  deleteByCardId(cardId: string): void;
}

export interface IChatMessageRepository {
  findByCardId(cardId: string): ChatMessageRow[];
  findByCardIdAndColumn(cardId: string, column: string): ChatMessageRow[];
  findByProjectId(projectId: string): ChatMessageRow[];
  create(data: ChatMessageRow): void;
  deleteByCardId(cardId: string): void;
  deleteByProjectId(projectId: string): void;
}

export interface IFileRepository {
  findById(id: string): FileRow | undefined;
  findByCardId(cardId: string): FileRow[];
  findByProjectId(projectId: string): FileRow[];
  findByIdAndCardId(id: string, cardId: string): FileRow | undefined;
  findByIdAndProjectId(id: string, projectId: string): FileRow | undefined;
  create(data: FileRow): void;
  delete(id: string): void;
  deleteByCardId(cardId: string): void;
}

// ── Combined repository context ─────────────────────────────────────────────

export interface RepositoryContext {
  projects: IProjectRepository;
  cards: ICardRepository;
  checklistItems: IChecklistItemRepository;
  chatMessages: IChatMessageRepository;
  files: IFileRepository;
}
