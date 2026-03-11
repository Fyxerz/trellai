import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  repoPath: text("repo_path").notNull(),
  chatSessionId: text("chat_session_id"),
  mode: text("mode").notNull().default("worktree"),
  createdAt: text("created_at").notNull(),
});

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  type: text("type").notNull().default("feature"),
  column: text("column").notNull().default("features"),
  position: integer("position").notNull().default(0),
  branchName: text("branch_name"),
  worktreePath: text("worktree_path"),
  claudeSessionId: text("claude_session_id"),
  agentStatus: text("agent_status").notNull().default("idle"),
  commitSha: text("commit_sha"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const checklistItems = sqliteTable("checklist_items", {
  id: text("id").primaryKey(),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  checked: integer("checked", { mode: "boolean" }).notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  cardId: text("card_id").references(() => cards.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  storedPath: text("stored_path").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull(),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  cardId: text("card_id").references(() => cards.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  column: text("column").notNull(),
  createdAt: text("created_at").notNull(),
});
