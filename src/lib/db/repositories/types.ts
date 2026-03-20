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
  repoUrl: string | null;
  chatSessionId: string | null;
  mode: string;
  storageMode: string;
  userId: string | null;
  teamId: string | null;
  createdAt: string;
}

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface TeamRow {
  id: string;
  name: string;
  isPersonal: boolean;
  createdAt: string;
}

export type TeamMemberRole = "owner" | "admin" | "member";

export interface TeamMemberRow {
  id: string;
  teamId: string;
  userId: string;
  role: TeamMemberRole;
  createdAt: string;
}

export type InviteStatus = "pending" | "accepted" | "declined" | "expired";

export interface InviteRow {
  id: string;
  teamId: string;
  email: string;
  role: TeamMemberRole;
  status: InviteStatus;
  invitedBy: string;
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
  assignedTo: string | null;
  commitSha: string | null;
  testStatus: string | null;
  testResults: string | null;
  isIcebox: number;
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

export interface ChatConversationRow {
  id: string;
  projectId: string;
  title: string;
  chatSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRow {
  id: string;
  cardId: string | null;
  projectId: string | null;
  conversationId: string | null;
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
  findByTeamId?(teamId: string): Promise<ProjectRow[]>;
  create(data: Omit<ProjectRow, "chatSessionId" | "repoUrl" | "storageMode" | "userId" | "teamId"> & { repoUrl?: string | null; storageMode?: string; userId?: string | null; teamId?: string | null }): Promise<void>;
  update(id: string, data: Partial<Pick<ProjectRow, "name" | "mode" | "repoUrl" | "chatSessionId" | "storageMode" | "teamId">>): Promise<void>;
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
  create(data: Omit<CardRow, "branchName" | "worktreePath" | "claudeSessionId" | "assignedTo" | "commitSha" | "testStatus" | "testResults"> & {
    branchName?: string | null;
    worktreePath?: string | null;
    claudeSessionId?: string | null;
    assignedTo?: string | null;
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
  findByConversationId(conversationId: string): Promise<ChatMessageRow[]>;
  create(data: ChatMessageRow): Promise<void>;
  deleteByCardId(cardId: string): Promise<void>;
  deleteByProjectId(projectId: string): Promise<void>;
  deleteByConversationId(conversationId: string): Promise<void>;
}

export interface IChatConversationRepository {
  findByProjectId(projectId: string): Promise<ChatConversationRow[]>;
  findById(id: string): Promise<ChatConversationRow | undefined>;
  create(data: ChatConversationRow): Promise<void>;
  update(id: string, data: Partial<Pick<ChatConversationRow, "title" | "chatSessionId" | "updatedAt">>): Promise<void>;
  delete(id: string): Promise<void>;
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

export interface IUserRepository {
  findById(id: string): Promise<UserRow | undefined>;
  findByEmail(email: string): Promise<UserRow | undefined>;
  upsert(data: UserRow): Promise<void>;
  update(id: string, data: Partial<Pick<UserRow, "name" | "avatarUrl">>): Promise<void>;
}

export interface ITeamRepository {
  findById(id: string): Promise<TeamRow | undefined>;
  findByUserId(userId: string): Promise<TeamRow[]>;
  findPersonalTeam(userId: string): Promise<TeamRow | undefined>;
  create(data: Omit<TeamRow, "id" | "createdAt"> & { id?: string }): Promise<TeamRow>;
  update(id: string, data: Partial<Pick<TeamRow, "name">>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ITeamMemberRepository {
  findByTeamId(teamId: string): Promise<TeamMemberRow[]>;
  findByUserId(userId: string): Promise<TeamMemberRow[]>;
  findByTeamAndUser(teamId: string, userId: string): Promise<TeamMemberRow | undefined>;
  create(data: Omit<TeamMemberRow, "id" | "createdAt"> & { id?: string }): Promise<void>;
  update(id: string, data: Partial<Pick<TeamMemberRow, "role">>): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByTeamAndUser(teamId: string, userId: string): Promise<void>;
}

export interface IInviteRepository {
  findById(id: string): Promise<InviteRow | undefined>;
  findByTeamId(teamId: string): Promise<InviteRow[]>;
  findByEmail(email: string): Promise<InviteRow[]>;
  findPendingByEmail(email: string): Promise<InviteRow[]>;
  create(data: Omit<InviteRow, "id" | "status" | "createdAt"> & { id?: string }): Promise<InviteRow>;
  update(id: string, data: Partial<Pick<InviteRow, "status" | "role">>): Promise<void>;
  delete(id: string): Promise<void>;
}

// ── Combined repository context ─────────────────────────────────────────────

export interface RepositoryContext {
  projects: IProjectRepository;
  cards: ICardRepository;
  checklistItems: IChecklistItemRepository;
  chatMessages: IChatMessageRepository;
  chatConversations: IChatConversationRepository;
  files: IFileRepository;
  users?: IUserRepository;
  teams?: ITeamRepository;
  teamMembers?: ITeamMemberRepository;
  invites?: IInviteRepository;
}
