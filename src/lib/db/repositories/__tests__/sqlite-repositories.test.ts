import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { SqliteProjectRepository } from "../sqlite/projects";
import { SqliteCardRepository } from "../sqlite/cards";
import { SqliteChecklistItemRepository } from "../sqlite/checklist-items";
import { SqliteChatMessageRepository } from "../sqlite/chat-messages";
import { SqliteFileRepository } from "../sqlite/files";
import { getLocalRepositories, getRepositories } from "../index";
import type { RepositoryContext } from "../types";

// We test against the real DB module (which auto-creates tables)
// since the SQLite repos depend on the singleton `db` from @/lib/db

describe("Repository Factory", () => {
  it("getLocalRepositories returns a RepositoryContext", () => {
    const repos = getLocalRepositories();
    expect(repos).toBeDefined();
    expect(repos.projects).toBeInstanceOf(SqliteProjectRepository);
    expect(repos.cards).toBeInstanceOf(SqliteCardRepository);
    expect(repos.checklistItems).toBeInstanceOf(SqliteChecklistItemRepository);
    expect(repos.chatMessages).toBeInstanceOf(SqliteChatMessageRepository);
    expect(repos.files).toBeInstanceOf(SqliteFileRepository);
  });

  it("getRepositories('local') returns SQLite repos", () => {
    const repos = getRepositories("local");
    expect(repos.projects).toBeInstanceOf(SqliteProjectRepository);
  });

  it("getRepositories('supabase') throws not-yet-implemented error", () => {
    expect(() => getRepositories("supabase")).toThrow(
      "Supabase storage mode is not yet implemented"
    );
  });

  it("getLocalRepositories returns same singleton", () => {
    const repos1 = getLocalRepositories();
    const repos2 = getLocalRepositories();
    expect(repos1).toBe(repos2);
  });
});

describe("SQLite Repository Interfaces", () => {
  let repos: RepositoryContext;

  beforeEach(() => {
    repos = getLocalRepositories();
  });

  describe("IProjectRepository", () => {
    const testProjectId = `test-proj-${Date.now()}`;

    afterEach(() => {
      // Cleanup
      try {
        repos.projects.delete(testProjectId);
      } catch {
        // May not exist
      }
    });

    it("create and findById", () => {
      repos.projects.create({
        id: testProjectId,
        name: "Test Project",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        createdAt: new Date().toISOString(),
      });

      const project = repos.projects.findById(testProjectId);
      expect(project).toBeDefined();
      expect(project!.name).toBe("Test Project");
      expect(project!.repoPath).toBe("/tmp/test-repo");
      expect(project!.mode).toBe("worktree");
      expect(project!.storageMode).toBe("local");
      expect(project!.chatSessionId).toBeNull();
    });

    it("findAll includes the created project", () => {
      repos.projects.create({
        id: testProjectId,
        name: "Test Project",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        createdAt: new Date().toISOString(),
      });

      const allProjects = repos.projects.findAll();
      expect(allProjects.some((p) => p.id === testProjectId)).toBe(true);
    });

    it("update changes name", () => {
      repos.projects.create({
        id: testProjectId,
        name: "Original",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        createdAt: new Date().toISOString(),
      });

      repos.projects.update(testProjectId, { name: "Updated" });
      const project = repos.projects.findById(testProjectId);
      expect(project!.name).toBe("Updated");
    });

    it("update changes storageMode", () => {
      repos.projects.create({
        id: testProjectId,
        name: "Test",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        createdAt: new Date().toISOString(),
      });

      repos.projects.update(testProjectId, { storageMode: "supabase" });
      const project = repos.projects.findById(testProjectId);
      expect(project!.storageMode).toBe("supabase");
    });

    it("delete removes the project", () => {
      repos.projects.create({
        id: testProjectId,
        name: "To Delete",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        createdAt: new Date().toISOString(),
      });

      repos.projects.delete(testProjectId);
      const project = repos.projects.findById(testProjectId);
      expect(project).toBeUndefined();
    });
  });

  describe("ICardRepository", () => {
    const testProjectId = `test-proj-card-${Date.now()}`;
    const testCardId = `test-card-${Date.now()}`;

    beforeEach(() => {
      repos.projects.create({
        id: testProjectId,
        name: "Card Test Project",
        repoPath: "/tmp/test-repo",
        mode: "worktree",
        createdAt: new Date().toISOString(),
      });
    });

    afterEach(() => {
      try {
        repos.cards.delete(testCardId);
      } catch { /* */ }
      try {
        repos.projects.delete(testProjectId);
      } catch { /* */ }
    });

    it("create and findById", () => {
      const now = new Date().toISOString();
      repos.cards.create({
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

      const card = repos.cards.findById(testCardId);
      expect(card).toBeDefined();
      expect(card!.title).toBe("Test Card");
      expect(card!.column).toBe("features");
      expect(card!.agentStatus).toBe("idle");
    });

    it("findByProjectId returns cards for project", () => {
      const now = new Date().toISOString();
      repos.cards.create({
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

      const cards = repos.cards.findByProjectId(testProjectId);
      expect(cards.length).toBeGreaterThanOrEqual(1);
      expect(cards.some((c) => c.id === testCardId)).toBe(true);
    });

    it("findByConditions filters correctly", () => {
      const now = new Date().toISOString();
      repos.cards.create({
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

      const running = repos.cards.findByConditions({
        projectId: testProjectId,
        column: "production",
        agentStatus: "running",
      });
      expect(running.some((c) => c.id === testCardId)).toBe(true);

      const queued = repos.cards.findByConditions({
        projectId: testProjectId,
        agentStatus: "queued",
      });
      expect(queued.some((c) => c.id === testCardId)).toBe(false);
    });

    it("findByConditions with array column filter", () => {
      const now = new Date().toISOString();
      repos.cards.create({
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

      const found = repos.cards.findByConditions({
        projectId: testProjectId,
        column: ["production", "review"],
      });
      expect(found.some((c) => c.id === testCardId)).toBe(true);
    });

    it("update modifies card fields", () => {
      const now = new Date().toISOString();
      repos.cards.create({
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

      repos.cards.update(testCardId, {
        title: "Updated",
        column: "production",
        agentStatus: "running",
      });

      const card = repos.cards.findById(testCardId);
      expect(card!.title).toBe("Updated");
      expect(card!.column).toBe("production");
      expect(card!.agentStatus).toBe("running");
    });
  });

  describe("IChecklistItemRepository", () => {
    const testProjectId = `test-proj-cl-${Date.now()}`;
    const testCardId = `test-card-cl-${Date.now()}`;
    const testItemId = `test-item-${Date.now()}`;

    beforeEach(() => {
      const now = new Date().toISOString();
      repos.projects.create({
        id: testProjectId,
        name: "CL Test",
        repoPath: "/tmp/test",
        mode: "worktree",
        createdAt: now,
      });
      repos.cards.create({
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

    afterEach(() => {
      try { repos.checklistItems.delete(testItemId, testCardId); } catch { /* */ }
      try { repos.cards.delete(testCardId); } catch { /* */ }
      try { repos.projects.delete(testProjectId); } catch { /* */ }
    });

    it("create and findByCardId", () => {
      repos.checklistItems.create({
        id: testItemId,
        cardId: testCardId,
        text: "Test item",
        checked: false,
        position: 0,
        createdAt: new Date().toISOString(),
      });

      const items = repos.checklistItems.findByCardId(testCardId);
      expect(items.length).toBe(1);
      expect(items[0].text).toBe("Test item");
      expect(items[0].checked).toBe(false);
    });

    it("update toggles checked", () => {
      repos.checklistItems.create({
        id: testItemId,
        cardId: testCardId,
        text: "Toggle me",
        checked: false,
        position: 0,
        createdAt: new Date().toISOString(),
      });

      repos.checklistItems.update(testItemId, testCardId, { checked: true });
      const item = repos.checklistItems.findById(testItemId);
      expect(item!.checked).toBe(true);
    });
  });

  describe("IChatMessageRepository", () => {
    const testProjectId = `test-proj-cm-${Date.now()}`;
    const testCardId = `test-card-cm-${Date.now()}`;
    const testMsgId = `test-msg-${Date.now()}`;

    beforeEach(() => {
      const now = new Date().toISOString();
      repos.projects.create({
        id: testProjectId,
        name: "CM Test",
        repoPath: "/tmp/test",
        mode: "worktree",
        createdAt: now,
      });
      repos.cards.create({
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

    afterEach(() => {
      try { repos.chatMessages.deleteByCardId(testCardId); } catch { /* */ }
      try { repos.chatMessages.deleteByProjectId(testProjectId); } catch { /* */ }
      try { repos.cards.delete(testCardId); } catch { /* */ }
      try { repos.projects.delete(testProjectId); } catch { /* */ }
    });

    it("create and findByCardId", () => {
      repos.chatMessages.create({
        id: testMsgId,
        cardId: testCardId,
        projectId: null,
        role: "user",
        content: "Hello",
        column: "features",
        messageType: null,
        createdAt: new Date().toISOString(),
      });

      const messages = repos.chatMessages.findByCardId(testCardId);
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe("Hello");
    });

    it("findByCardIdAndColumn filters by column", () => {
      repos.chatMessages.create({
        id: testMsgId,
        cardId: testCardId,
        projectId: null,
        role: "user",
        content: "In features",
        column: "features",
        messageType: null,
        createdAt: new Date().toISOString(),
      });

      const features = repos.chatMessages.findByCardIdAndColumn(testCardId, "features");
      expect(features.length).toBe(1);

      const production = repos.chatMessages.findByCardIdAndColumn(testCardId, "production");
      expect(production.length).toBe(0);
    });

    it("findByProjectId returns project-level messages", () => {
      repos.chatMessages.create({
        id: testMsgId,
        cardId: null,
        projectId: testProjectId,
        role: "user",
        content: "Project message",
        column: "project",
        messageType: null,
        createdAt: new Date().toISOString(),
      });

      const messages = repos.chatMessages.findByProjectId(testProjectId);
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe("Project message");
    });
  });

  describe("IFileRepository", () => {
    const testProjectId = `test-proj-f-${Date.now()}`;
    const testCardId = `test-card-f-${Date.now()}`;
    const testFileId = `test-file-${Date.now()}`;

    beforeEach(() => {
      const now = new Date().toISOString();
      repos.projects.create({
        id: testProjectId,
        name: "File Test",
        repoPath: "/tmp/test",
        mode: "worktree",
        createdAt: now,
      });
      repos.cards.create({
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

    afterEach(() => {
      try { repos.files.delete(testFileId); } catch { /* */ }
      try { repos.cards.delete(testCardId); } catch { /* */ }
      try { repos.projects.delete(testProjectId); } catch { /* */ }
    });

    it("create and findById", () => {
      repos.files.create({
        id: testFileId,
        projectId: testProjectId,
        cardId: testCardId,
        filename: "test.txt",
        storedPath: "/tmp/test.txt",
        mimeType: "text/plain",
        size: 100,
        createdAt: new Date().toISOString(),
      });

      const file = repos.files.findById(testFileId);
      expect(file).toBeDefined();
      expect(file!.filename).toBe("test.txt");
    });

    it("findByProjectId returns project-level files only", () => {
      // Create a project-level file (no card)
      const projectFileId = `test-pfile-${Date.now()}`;
      repos.files.create({
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
      repos.files.create({
        id: testFileId,
        projectId: testProjectId,
        cardId: testCardId,
        filename: "card.txt",
        storedPath: "/tmp/card.txt",
        mimeType: "text/plain",
        size: 75,
        createdAt: new Date().toISOString(),
      });

      const projectFiles = repos.files.findByProjectId(testProjectId);
      expect(projectFiles.length).toBe(1);
      expect(projectFiles[0].filename).toBe("project.txt");

      // Cleanup
      repos.files.delete(projectFileId);
    });

    it("findByCardId returns card files", () => {
      repos.files.create({
        id: testFileId,
        projectId: testProjectId,
        cardId: testCardId,
        filename: "card-file.txt",
        storedPath: "/tmp/card-file.txt",
        mimeType: "text/plain",
        size: 100,
        createdAt: new Date().toISOString(),
      });

      const cardFiles = repos.files.findByCardId(testCardId);
      expect(cardFiles.length).toBe(1);
      expect(cardFiles[0].filename).toBe("card-file.txt");
    });
  });
});
