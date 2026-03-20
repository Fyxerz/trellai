import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { SqliteProjectRepository } from "../sqlite/projects";
import { SqliteCardRepository } from "../sqlite/cards";
import { SqliteChecklistItemRepository } from "../sqlite/checklist-items";
import { SqliteChatMessageRepository } from "../sqlite/chat-messages";
import { SqliteFileRepository } from "../sqlite/files";
import { SqliteUserRepository } from "../sqlite/users";
import { SqliteTeamRepository } from "../sqlite/teams";
import { SqliteTeamMemberRepository } from "../sqlite/team-members";
import { SqliteInviteRepository } from "../sqlite/invites";
import { SupabaseProjectRepository } from "../supabase/projects";
import { SupabaseCardRepository } from "../supabase/cards";
import { SupabaseChecklistItemRepository } from "../supabase/checklist-items";
import { SupabaseChatMessageRepository } from "../supabase/chat-messages";
import { SupabaseFileRepository } from "../supabase/files";
import { SupabaseUserRepository } from "../supabase/users";
import { SupabaseTeamRepository } from "../supabase/teams";
import { SupabaseTeamMemberRepository } from "../supabase/team-members";
import { SupabaseInviteRepository } from "../supabase/invites";
import { getLocalRepositories, getRepositories } from "../index";
import type { RepositoryContext } from "../types";

// We test against the real DB module (which auto-creates tables)
// since the SQLite repos depend on the singleton `db` from @/lib/db

describe("Repository Factory", () => {
  it("getLocalRepositories returns a RepositoryContext", async () => {
    const repos = await getLocalRepositories();
    expect(repos).toBeDefined();
    expect(repos.projects).toBeInstanceOf(SqliteProjectRepository);
    expect(repos.cards).toBeInstanceOf(SqliteCardRepository);
    expect(repos.checklistItems).toBeInstanceOf(SqliteChecklistItemRepository);
    expect(repos.chatMessages).toBeInstanceOf(SqliteChatMessageRepository);
    expect(repos.files).toBeInstanceOf(SqliteFileRepository);
  });

  it("getRepositories('local') returns SQLite repos", async () => {
    const repos = await getRepositories("local");
    expect(repos.projects).toBeInstanceOf(SqliteProjectRepository);
  });

  it("getRepositories('supabase') returns a valid RepositoryContext", async () => {
    const repos = await getRepositories("supabase");
    expect(repos).toBeDefined();
    expect(repos.projects).toBeInstanceOf(SupabaseProjectRepository);
    expect(repos.cards).toBeInstanceOf(SupabaseCardRepository);
    expect(repos.checklistItems).toBeInstanceOf(SupabaseChecklistItemRepository);
    expect(repos.chatMessages).toBeInstanceOf(SupabaseChatMessageRepository);
    expect(repos.files).toBeInstanceOf(SupabaseFileRepository);
  });

  it("getRepositories('supabase') includes team repositories", async () => {
    const repos = await getRepositories("supabase");
    expect(repos.users).toBeInstanceOf(SupabaseUserRepository);
    expect(repos.teams).toBeInstanceOf(SupabaseTeamRepository);
    expect(repos.teamMembers).toBeInstanceOf(SupabaseTeamMemberRepository);
    expect(repos.invites).toBeInstanceOf(SupabaseInviteRepository);
  });

  it("getRepositories('local') includes SQLite team repositories", async () => {
    const repos = await getRepositories("local");
    expect(repos.users).toBeInstanceOf(SqliteUserRepository);
    expect(repos.teams).toBeInstanceOf(SqliteTeamRepository);
    expect(repos.teamMembers).toBeInstanceOf(SqliteTeamMemberRepository);
    expect(repos.invites).toBeInstanceOf(SqliteInviteRepository);
  });

  it("getLocalRepositories returns same singleton", async () => {
    const repos1 = await getLocalRepositories();
    const repos2 = await getLocalRepositories();
    expect(repos1).toBe(repos2);
  });
});

describe("SQLite Repository Interfaces", () => {
  let repos: RepositoryContext;

  beforeEach(async () => {
    repos = await getLocalRepositories();
  });

  describe("IProjectRepository", () => {
    const testProjectId = `test-proj-${Date.now()}`;

    afterEach(async () => {
      // Cleanup
      try {
        await repos.projects.delete(testProjectId);
      } catch {
        // May not exist
      }
    });

    it("create and findById", async () => {
      await repos.projects.create({
        id: testProjectId,
        name: "Test Project",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        createdAt: new Date().toISOString(),
      });

      const project = await repos.projects.findById(testProjectId);
      expect(project).toBeDefined();
      expect(project!.name).toBe("Test Project");
      expect(project!.repoPath).toBe("/tmp/test-repo");
      expect(project!.mode).toBe("worktree");
      expect(project!.storageMode).toBe("local");
      expect(project!.chatSessionId).toBeNull();
    });

    it("create with teamId", async () => {
      const teamId = "test-team-123";
      await repos.projects.create({
        id: testProjectId,
        name: "Team Project",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        teamId,
        createdAt: new Date().toISOString(),
      });

      const project = await repos.projects.findById(testProjectId);
      expect(project).toBeDefined();
      expect(project!.teamId).toBe(teamId);
    });

    it("create without teamId defaults to null", async () => {
      await repos.projects.create({
        id: testProjectId,
        name: "No Team Project",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        createdAt: new Date().toISOString(),
      });

      const project = await repos.projects.findById(testProjectId);
      expect(project).toBeDefined();
      expect(project!.teamId).toBeNull();
    });

    it("findByTeamId returns team projects", async () => {
      const teamId = `team-find-${Date.now()}`;
      await repos.projects.create({
        id: testProjectId,
        name: "Team Project",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        teamId,
        createdAt: new Date().toISOString(),
      });

      const teamProjects = await repos.projects.findByTeamId!(teamId);
      expect(teamProjects.some((p) => p.id === testProjectId)).toBe(true);
    });

    it("update changes teamId", async () => {
      await repos.projects.create({
        id: testProjectId,
        name: "Test",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        createdAt: new Date().toISOString(),
      });

      const newTeamId = "updated-team-456";
      await repos.projects.update(testProjectId, { teamId: newTeamId });
      const project = await repos.projects.findById(testProjectId);
      expect(project!.teamId).toBe(newTeamId);
    });

    it("findAll includes the created project", async () => {
      await repos.projects.create({
        id: testProjectId,
        name: "Test Project",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        createdAt: new Date().toISOString(),
      });

      const allProjects = await repos.projects.findAll();
      expect(allProjects.some((p) => p.id === testProjectId)).toBe(true);
    });

    it("update changes name", async () => {
      await repos.projects.create({
        id: testProjectId,
        name: "Original",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        createdAt: new Date().toISOString(),
      });

      await repos.projects.update(testProjectId, { name: "Updated" });
      const project = await repos.projects.findById(testProjectId);
      expect(project!.name).toBe("Updated");
    });

    it("update changes storageMode", async () => {
      await repos.projects.create({
        id: testProjectId,
        name: "Test",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        createdAt: new Date().toISOString(),
      });

      await repos.projects.update(testProjectId, { storageMode: "supabase" });
      const project = await repos.projects.findById(testProjectId);
      expect(project!.storageMode).toBe("supabase");
    });

    it("delete removes the project", async () => {
      await repos.projects.create({
        id: testProjectId,
        name: "To Delete",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        createdAt: new Date().toISOString(),
      });

      await repos.projects.delete(testProjectId);
      const project = await repos.projects.findById(testProjectId);
      expect(project).toBeUndefined();
    });
  });

  describe("ICardRepository", () => {
    const testProjectId = `test-proj-card-${Date.now()}`;
    const testCardId = `test-card-${Date.now()}`;

    beforeEach(async () => {
      await repos.projects.create({
        id: testProjectId,
        name: "Card Test Project",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        createdAt: new Date().toISOString(),
      });
    });

    afterEach(async () => {
      try {
        await repos.cards.delete(testCardId);
      } catch { /* */ }
      try {
        await repos.projects.delete(testProjectId);
      } catch { /* */ }
    });

    it("create and findById", async () => {
      const now = new Date().toISOString();
      await repos.cards.create({
        id: testCardId,
        projectId: testProjectId,
        title: "Test Card",
        description: "A test card",
        type: "feature",
        column: "features",
        position: 0,
        agentStatus: "idle",
        createdAt: now,
        updatedAt: now,
      });

      const card = await repos.cards.findById(testCardId);
      expect(card).toBeDefined();
      expect(card!.title).toBe("Test Card");
      expect(card!.column).toBe("features");
      expect(card!.agentStatus).toBe("idle");
    });

    it("findByProjectId returns cards for project", async () => {
      const now = new Date().toISOString();
      await repos.cards.create({
        id: testCardId,
        projectId: testProjectId,
        title: "Test Card",
        description: "",
        type: "feature",
        column: "features",
        position: 0,
        agentStatus: "idle",
        createdAt: now,
        updatedAt: now,
      });

      const cards = await repos.cards.findByProjectId(testProjectId);
      expect(cards.length).toBeGreaterThanOrEqual(1);
      expect(cards.some((c) => c.id === testCardId)).toBe(true);
    });

    it("findByConditions filters correctly", async () => {
      const now = new Date().toISOString();
      await repos.cards.create({
        id: testCardId,
        projectId: testProjectId,
        title: "Production Card",
        description: "",
        type: "feature",
        column: "production",
        position: 0,
        agentStatus: "running",
        createdAt: now,
        updatedAt: now,
      });

      const running = await repos.cards.findByConditions({
        projectId: testProjectId,
        column: "production",
        agentStatus: "running",
      });
      expect(running.some((c) => c.id === testCardId)).toBe(true);

      const queued = await repos.cards.findByConditions({
        projectId: testProjectId,
        agentStatus: "queued",
      });
      expect(queued.some((c) => c.id === testCardId)).toBe(false);
    });

    it("findByConditions with array column filter", async () => {
      const now = new Date().toISOString();
      await repos.cards.create({
        id: testCardId,
        projectId: testProjectId,
        title: "Review Card",
        description: "",
        type: "feature",
        column: "review",
        position: 0,
        agentStatus: "complete",
        createdAt: now,
        updatedAt: now,
      });

      const found = await repos.cards.findByConditions({
        projectId: testProjectId,
        column: ["production", "review"],
      });
      expect(found.some((c) => c.id === testCardId)).toBe(true);
    });

    it("update modifies card fields", async () => {
      const now = new Date().toISOString();
      await repos.cards.create({
        id: testCardId,
        projectId: testProjectId,
        title: "Original",
        description: "",
        type: "feature",
        column: "features",
        position: 0,
        agentStatus: "idle",
        createdAt: now,
        updatedAt: now,
      });

      await repos.cards.update(testCardId, {
        title: "Updated",
        column: "production",
        agentStatus: "running",
      });

      const card = await repos.cards.findById(testCardId);
      expect(card!.title).toBe("Updated");
      expect(card!.column).toBe("production");
      expect(card!.agentStatus).toBe("running");
    });
  });

  describe("IChecklistItemRepository", () => {
    const testProjectId = `test-proj-cl-${Date.now()}`;
    const testCardId = `test-card-cl-${Date.now()}`;
    const testItemId = `test-item-${Date.now()}`;

    beforeEach(async () => {
      const now = new Date().toISOString();
      await repos.projects.create({
        id: testProjectId,
        name: "CL Test",
        repoPath: "/tmp/test",
        mode: "worktree",
        createdAt: now,
      });
      await repos.cards.create({
        id: testCardId,
        projectId: testProjectId,
        title: "CL Card",
        description: "",
        type: "feature",
        column: "features",
        position: 0,
        agentStatus: "idle",
        createdAt: now,
        updatedAt: now,
      });
    });

    afterEach(async () => {
      try { await repos.checklistItems.delete(testItemId, testCardId); } catch { /* */ }
      try { await repos.cards.delete(testCardId); } catch { /* */ }
      try { await repos.projects.delete(testProjectId); } catch { /* */ }
    });

    it("create and findByCardId", async () => {
      await repos.checklistItems.create({
        id: testItemId,
        cardId: testCardId,
        text: "Test item",
        checked: false,
        position: 0,
        createdAt: new Date().toISOString(),
      });

      const items = await repos.checklistItems.findByCardId(testCardId);
      expect(items.length).toBe(1);
      expect(items[0].text).toBe("Test item");
      expect(items[0].checked).toBe(false);
    });

    it("update toggles checked", async () => {
      await repos.checklistItems.create({
        id: testItemId,
        cardId: testCardId,
        text: "Toggle me",
        checked: false,
        position: 0,
        createdAt: new Date().toISOString(),
      });

      await repos.checklistItems.update(testItemId, testCardId, { checked: true });
      const item = await repos.checklistItems.findById(testItemId);
      expect(item!.checked).toBe(true);
    });
  });

  describe("IChatMessageRepository", () => {
    const testProjectId = `test-proj-cm-${Date.now()}`;
    const testCardId = `test-card-cm-${Date.now()}`;
    const testMsgId = `test-msg-${Date.now()}`;

    beforeEach(async () => {
      const now = new Date().toISOString();
      await repos.projects.create({
        id: testProjectId,
        name: "CM Test",
        repoPath: "/tmp/test",
        mode: "worktree",
        createdAt: now,
      });
      await repos.cards.create({
        id: testCardId,
        projectId: testProjectId,
        title: "CM Card",
        description: "",
        type: "feature",
        column: "features",
        position: 0,
        agentStatus: "idle",
        createdAt: now,
        updatedAt: now,
      });
    });

    afterEach(async () => {
      try { await repos.chatMessages.deleteByCardId(testCardId); } catch { /* */ }
      try { await repos.chatMessages.deleteByProjectId(testProjectId); } catch { /* */ }
      try { await repos.cards.delete(testCardId); } catch { /* */ }
      try { await repos.projects.delete(testProjectId); } catch { /* */ }
    });

    it("create and findByCardId", async () => {
      await repos.chatMessages.create({
        id: testMsgId,
        cardId: testCardId,
        projectId: null,
        role: "user",
        content: "Hello",
        column: "features",
        messageType: null,
        createdAt: new Date().toISOString(),
      });

      const messages = await repos.chatMessages.findByCardId(testCardId);
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe("Hello");
    });

    it("findByCardIdAndColumn filters by column", async () => {
      await repos.chatMessages.create({
        id: testMsgId,
        cardId: testCardId,
        projectId: null,
        role: "user",
        content: "In features",
        column: "features",
        messageType: null,
        createdAt: new Date().toISOString(),
      });

      const features = await repos.chatMessages.findByCardIdAndColumn(testCardId, "features");
      expect(features.length).toBe(1);

      const production = await repos.chatMessages.findByCardIdAndColumn(testCardId, "production");
      expect(production.length).toBe(0);
    });

    it("findByProjectId returns project-level messages", async () => {
      await repos.chatMessages.create({
        id: testMsgId,
        cardId: null,
        projectId: testProjectId,
        role: "user",
        content: "Project message",
        column: "project",
        messageType: null,
        createdAt: new Date().toISOString(),
      });

      const messages = await repos.chatMessages.findByProjectId(testProjectId);
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe("Project message");
    });
  });

  describe("IFileRepository", () => {
    const testProjectId = `test-proj-f-${Date.now()}`;
    const testCardId = `test-card-f-${Date.now()}`;
    const testFileId = `test-file-${Date.now()}`;

    beforeEach(async () => {
      const now = new Date().toISOString();
      await repos.projects.create({
        id: testProjectId,
        name: "File Test",
        repoPath: "/tmp/test",
        mode: "worktree",
        createdAt: now,
      });
      await repos.cards.create({
        id: testCardId,
        projectId: testProjectId,
        title: "File Card",
        description: "",
        type: "feature",
        column: "features",
        position: 0,
        agentStatus: "idle",
        createdAt: now,
        updatedAt: now,
      });
    });

    afterEach(async () => {
      try { await repos.files.delete(testFileId); } catch { /* */ }
      try { await repos.cards.delete(testCardId); } catch { /* */ }
      try { await repos.projects.delete(testProjectId); } catch { /* */ }
    });

    it("create and findById", async () => {
      await repos.files.create({
        id: testFileId,
        projectId: testProjectId,
        cardId: testCardId,
        filename: "test.txt",
        storedPath: "/tmp/test.txt",
        mimeType: "text/plain",
        size: 100,
        createdAt: new Date().toISOString(),
      });

      const file = await repos.files.findById(testFileId);
      expect(file).toBeDefined();
      expect(file!.filename).toBe("test.txt");
    });

    it("findByProjectId returns project-level files only", async () => {
      // Create a project-level file (no card)
      const projectFileId = `test-pfile-${Date.now()}`;
      await repos.files.create({
        id: projectFileId,
        projectId: testProjectId,
        cardId: null,
        filename: "project.txt",
        storedPath: "/tmp/project.txt",
        mimeType: "text/plain",
        size: 50,
        createdAt: new Date().toISOString(),
      });

      // Create a card-level file
      await repos.files.create({
        id: testFileId,
        projectId: testProjectId,
        cardId: testCardId,
        filename: "card.txt",
        storedPath: "/tmp/card.txt",
        mimeType: "text/plain",
        size: 75,
        createdAt: new Date().toISOString(),
      });

      const projectFiles = await repos.files.findByProjectId(testProjectId);
      expect(projectFiles.length).toBe(1);
      expect(projectFiles[0].filename).toBe("project.txt");

      // Cleanup
      await repos.files.delete(projectFileId);
    });

    it("findByCardId returns card files", async () => {
      await repos.files.create({
        id: testFileId,
        projectId: testProjectId,
        cardId: testCardId,
        filename: "card-file.txt",
        storedPath: "/tmp/card-file.txt",
        mimeType: "text/plain",
        size: 100,
        createdAt: new Date().toISOString(),
      });

      const cardFiles = await repos.files.findByCardId(testCardId);
      expect(cardFiles.length).toBe(1);
      expect(cardFiles[0].filename).toBe("card-file.txt");
    });
  });

  describe("IUserRepository", () => {
    const testUserId = `test-user-${Date.now()}`;

    afterEach(async () => {
      try {
        // Direct cleanup via DB
        const { db } = await import("@/lib/db");
        const { users } = await import("@/lib/db/schema");
        const { eq } = await import("drizzle-orm");
        db.delete(users).where(eq(users.id, testUserId)).run();
      } catch { /* */ }
    });

    it("upsert creates a new user", async () => {
      await repos.users!.upsert({
        id: testUserId,
        email: "test@example.com",
        name: "Test User",
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      });

      const user = await repos.users!.findById(testUserId);
      expect(user).toBeDefined();
      expect(user!.email).toBe("test@example.com");
      expect(user!.name).toBe("Test User");
    });

    it("upsert updates existing user", async () => {
      await repos.users!.upsert({
        id: testUserId,
        email: "test@example.com",
        name: "Original",
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      });

      await repos.users!.upsert({
        id: testUserId,
        email: "updated@example.com",
        name: "Updated",
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      });

      const user = await repos.users!.findById(testUserId);
      expect(user!.email).toBe("updated@example.com");
      expect(user!.name).toBe("Updated");
    });

    it("findByEmail returns user", async () => {
      const email = `findbyemail-${Date.now()}@example.com`;
      await repos.users!.upsert({
        id: testUserId,
        email,
        name: null,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      });

      const user = await repos.users!.findByEmail(email);
      expect(user).toBeDefined();
      expect(user!.id).toBe(testUserId);
    });

    it("update changes name", async () => {
      await repos.users!.upsert({
        id: testUserId,
        email: "test@example.com",
        name: "Original",
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      });

      await repos.users!.update(testUserId, { name: "New Name" });
      const user = await repos.users!.findById(testUserId);
      expect(user!.name).toBe("New Name");
    });
  });

  describe("ITeamRepository", () => {
    const testUserId = `test-user-team-${Date.now()}`;
    let createdTeamIds: string[] = [];

    beforeEach(async () => {
      createdTeamIds = [];
      await repos.users!.upsert({
        id: testUserId,
        email: "team-test@example.com",
        name: "Team Tester",
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      });
    });

    afterEach(async () => {
      try {
        const { db } = await import("@/lib/db");
        const { teamMembers, teams, users } = await import("@/lib/db/schema");
        const { eq } = await import("drizzle-orm");
        for (const id of createdTeamIds) {
          db.delete(teamMembers).where(eq(teamMembers.teamId, id)).run();
          db.delete(teams).where(eq(teams.id, id)).run();
        }
        db.delete(users).where(eq(users.id, testUserId)).run();
      } catch { /* */ }
    });

    it("create and findById", async () => {
      const team = await repos.teams!.create({ name: "Test Team", isPersonal: false });
      createdTeamIds.push(team.id);

      expect(team.name).toBe("Test Team");
      expect(team.isPersonal).toBe(false);

      const found = await repos.teams!.findById(team.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe("Test Team");
    });

    it("findByUserId returns teams user belongs to", async () => {
      const team = await repos.teams!.create({ name: "User Team", isPersonal: false });
      createdTeamIds.push(team.id);

      await repos.teamMembers!.create({
        teamId: team.id,
        userId: testUserId,
        role: "owner",
      });

      const userTeams = await repos.teams!.findByUserId(testUserId);
      expect(userTeams.some((t) => t.id === team.id)).toBe(true);
    });

    it("findPersonalTeam returns personal team", async () => {
      const team = await repos.teams!.create({ name: "My Personal", isPersonal: true });
      createdTeamIds.push(team.id);

      await repos.teamMembers!.create({
        teamId: team.id,
        userId: testUserId,
        role: "owner",
      });

      const personal = await repos.teams!.findPersonalTeam(testUserId);
      expect(personal).toBeDefined();
      expect(personal!.isPersonal).toBe(true);
    });

    it("update changes team name", async () => {
      const team = await repos.teams!.create({ name: "Original", isPersonal: false });
      createdTeamIds.push(team.id);

      await repos.teams!.update(team.id, { name: "Renamed" });
      const found = await repos.teams!.findById(team.id);
      expect(found!.name).toBe("Renamed");
    });

    it("delete removes team", async () => {
      const team = await repos.teams!.create({ name: "To Delete", isPersonal: false });
      // Don't add to createdTeamIds since we're deleting it

      await repos.teams!.delete(team.id);
      const found = await repos.teams!.findById(team.id);
      expect(found).toBeUndefined();
    });
  });

  describe("ITeamMemberRepository", () => {
    const testUserId = `test-user-tm-${Date.now()}`;
    const testUserId2 = `test-user-tm2-${Date.now()}`;
    let testTeamId: string;

    beforeEach(async () => {
      await repos.users!.upsert({
        id: testUserId,
        email: "tm1@example.com",
        name: null,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      });
      await repos.users!.upsert({
        id: testUserId2,
        email: "tm2@example.com",
        name: null,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      });
      const team = await repos.teams!.create({ name: "TM Test Team", isPersonal: false });
      testTeamId = team.id;
    });

    afterEach(async () => {
      try {
        const { db } = await import("@/lib/db");
        const { teamMembers, teams, users } = await import("@/lib/db/schema");
        const { eq } = await import("drizzle-orm");
        db.delete(teamMembers).where(eq(teamMembers.teamId, testTeamId)).run();
        db.delete(teams).where(eq(teams.id, testTeamId)).run();
        db.delete(users).where(eq(users.id, testUserId)).run();
        db.delete(users).where(eq(users.id, testUserId2)).run();
      } catch { /* */ }
    });

    it("create and findByTeamId", async () => {
      await repos.teamMembers!.create({
        teamId: testTeamId,
        userId: testUserId,
        role: "owner",
      });

      const members = await repos.teamMembers!.findByTeamId(testTeamId);
      expect(members.length).toBe(1);
      expect(members[0].role).toBe("owner");
    });

    it("findByTeamAndUser returns specific membership", async () => {
      await repos.teamMembers!.create({
        teamId: testTeamId,
        userId: testUserId,
        role: "admin",
      });

      const member = await repos.teamMembers!.findByTeamAndUser(testTeamId, testUserId);
      expect(member).toBeDefined();
      expect(member!.role).toBe("admin");
    });

    it("update changes role", async () => {
      await repos.teamMembers!.create({
        teamId: testTeamId,
        userId: testUserId,
        role: "member",
      });

      const members = await repos.teamMembers!.findByTeamId(testTeamId);
      const member = members[0];

      await repos.teamMembers!.update(member.id, { role: "admin" });

      const updated = await repos.teamMembers!.findByTeamAndUser(testTeamId, testUserId);
      expect(updated!.role).toBe("admin");
    });

    it("deleteByTeamAndUser removes membership", async () => {
      await repos.teamMembers!.create({
        teamId: testTeamId,
        userId: testUserId,
        role: "member",
      });

      await repos.teamMembers!.deleteByTeamAndUser(testTeamId, testUserId);

      const member = await repos.teamMembers!.findByTeamAndUser(testTeamId, testUserId);
      expect(member).toBeUndefined();
    });

    it("findByUserId returns all memberships for a user", async () => {
      await repos.teamMembers!.create({
        teamId: testTeamId,
        userId: testUserId,
        role: "member",
      });

      const memberships = await repos.teamMembers!.findByUserId(testUserId);
      expect(memberships.some((m) => m.teamId === testTeamId)).toBe(true);
    });
  });

  describe("IInviteRepository", () => {
    const testUserId = `test-user-inv-${Date.now()}`;
    let testTeamId: string;

    beforeEach(async () => {
      await repos.users!.upsert({
        id: testUserId,
        email: "inviter@example.com",
        name: null,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      });
      const team = await repos.teams!.create({ name: "Invite Test Team", isPersonal: false });
      testTeamId = team.id;
    });

    afterEach(async () => {
      try {
        const { db } = await import("@/lib/db");
        const { invites, teamMembers, teams, users } = await import("@/lib/db/schema");
        const { eq } = await import("drizzle-orm");
        db.delete(invites).where(eq(invites.teamId, testTeamId)).run();
        db.delete(teamMembers).where(eq(teamMembers.teamId, testTeamId)).run();
        db.delete(teams).where(eq(teams.id, testTeamId)).run();
        db.delete(users).where(eq(users.id, testUserId)).run();
      } catch { /* */ }
    });

    it("create and findById", async () => {
      const invite = await repos.invites!.create({
        teamId: testTeamId,
        email: "new@example.com",
        role: "member",
        invitedBy: testUserId,
      });

      expect(invite.status).toBe("pending");
      expect(invite.email).toBe("new@example.com");

      const found = await repos.invites!.findById(invite.id);
      expect(found).toBeDefined();
      expect(found!.email).toBe("new@example.com");
    });

    it("findByTeamId returns team invites", async () => {
      await repos.invites!.create({
        teamId: testTeamId,
        email: "a@example.com",
        role: "member",
        invitedBy: testUserId,
      });

      const invites = await repos.invites!.findByTeamId(testTeamId);
      expect(invites.length).toBe(1);
    });

    it("findPendingByEmail returns only pending invites", async () => {
      const email = `pending-${Date.now()}@example.com`;
      const invite = await repos.invites!.create({
        teamId: testTeamId,
        email,
        role: "member",
        invitedBy: testUserId,
      });

      const pending = await repos.invites!.findPendingByEmail(email);
      expect(pending.length).toBe(1);

      // Accept the invite
      await repos.invites!.update(invite.id, { status: "accepted" });

      const pendingAfter = await repos.invites!.findPendingByEmail(email);
      expect(pendingAfter.length).toBe(0);
    });

    it("update changes status", async () => {
      const invite = await repos.invites!.create({
        teamId: testTeamId,
        email: "status@example.com",
        role: "member",
        invitedBy: testUserId,
      });

      await repos.invites!.update(invite.id, { status: "declined" });

      const found = await repos.invites!.findById(invite.id);
      expect(found!.status).toBe("declined");
    });

    it("delete removes invite", async () => {
      const invite = await repos.invites!.create({
        teamId: testTeamId,
        email: "delete@example.com",
        role: "member",
        invitedBy: testUserId,
      });

      await repos.invites!.delete(invite.id);

      const found = await repos.invites!.findById(invite.id);
      expect(found).toBeUndefined();
    });

    it("findByEmail returns all invites for an email", async () => {
      const email = `all-${Date.now()}@example.com`;
      await repos.invites!.create({
        teamId: testTeamId,
        email,
        role: "member",
        invitedBy: testUserId,
      });

      const invites = await repos.invites!.findByEmail(email);
      expect(invites.length).toBe(1);
      expect(invites[0].email).toBe(email);
    });
  });
});
