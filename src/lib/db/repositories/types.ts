/**
 * Repository interfaces for the Trellai data layer.
 *
 * These abstract all database access so we can swap between
 * SQLite (local/private boards) and Supabase (public/shared boards).
 *
 * All methods return Promises for async compatibility with Supabase.
 * SQLite implementations wrap their sync results automatically via async.
 */

// ── Row types ───────────────────────────────────────────────────────────────

export interface ProjectRow {
  id: string;
  name: string;
  repoPath: string;
  chatSessionId: string | null;
  mode: string;
  storageMode: string;
  userId: string | null;
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
  findAll(): Promise<ProjectRow[]>;
  findById(id: string): Promise<ProjectRow | undefined>;
  create(data: Omit<ProjectRow, "chatSessionId" | "storageMode" | "userId"> & { storageMode?: string; userId?: string | null }): Promise<void>;
  update(id: string, data: Partial<Pick<ProjectRow, "name" | "mode" | "chatSessionId" | "storageMode">>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ICardRepository {
  findAll(): Promise<CardRow[]>;
  findById(id: string): Promise<CardRow | undefined>;
  findByProjectId(projectId: string): Promise<CardRow[]>;
  findByConditions(conditions: {
    projectId?: string;
    column?: string | string[];
    agentStatus?: string;
    notId?: string;
  }): Promise<CardRow[]>;
  create(data: Omit<CardRow, "branchName" | "worktreePath" | "claudeSessionId" | "commitSha" | "testStatus" | "testResults"> & {
    branchName?: string | null;
    worktreePath?: string | null;
    claudeSessionId?: string | null;
    commitSha?: string | null;
    testStatus?: string | null;
    testResults?: string | null;
  }): Promise<void>;
  update(id: string, data: Partial<Omit<CardRow, "id">>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface IChecklistItemRepository {
  findByCardId(cardId: string): Promise<ChecklistItemRow[]>;
  findById(id: string): Promise<ChecklistItemRow | undefined>;
  create(data: ChecklistItemRow): Promise<void>;
  update(id: string, cardId: string, data: Partial<Pick<ChecklistItemRow, "text" | "checked" | "position">>): Promise<void>;
  delete(id: string, cardId: string): Promise<void>;
  deleteByCardId(cardId: string): Promise<void>;
}

export interface IChatMessageRepository {
  findByCardId(cardId: string): Promise<ChatMessageRow[]>;
  findByCardIdAndColumn(cardId: string, column: string): Promise<ChatMessageRow[]>;
  findByProjectId(projectId: string): Promise<ChatMessageRow[]>;
  create(data: ChatMessageRow): Promise<void>;
  deleteByCardId(cardId: string): Promise<void>;
  deleteByProjectId(projectId: string): Promise<void>;
}

export interface IFileRepository {
  findById(id: string): Promise<FileRow | undefined>;
  findByCardId(cardId: string): Promise<FileRow[]>;
  findByProjectId(projectId: string): Promise<FileRow[]>;
  findByIdAndCardId(id: string, cardId: string): Promise<FileRow | undefined>;
  findByIdAndProjectId(id: string, projectId: string): Promise<FileRow | undefined>;
  create(data: FileRow): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByCardId(cardId: string): Promise<void>;
}

// ── Combined repository context ─────────────────────────────────────────────

export interface RepositoryContext {
  projects: IProjectRepository;
  cards: ICardRepository;
  checklistItems: IChecklistItemRepository;
  chatMessages: IChatMessageRepository;
  files: IFileRepository;
}
