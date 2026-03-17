import { db } from "@/lib/db";
import { cards, projects, chatMessages, checklistItems, files } from "@/lib/db/schema";
import { eq, and, ne, isNull } from "drizzle-orm";
import { worktreeManager } from "./worktree-manager";
import { queueManager } from "./queue-manager";
import { ClaudeProcess } from "./claude-process";
import { v4 as uuid } from "uuid";
import { existsSync } from "fs";
import { emitToCard, emitToProject, emitGlobal } from "@/lib/socket";
import { copySessionToProject } from "./session-transfer";
import { createBoardMcpServer, createQuestionMcpServer } from "./mcp-tools";

const PLANNING_SYSTEM_PROMPT = `You are helping plan and build a feature. You have READ-ONLY access to the codebase — you can explore files, search code, and run read-only commands, but you cannot edit or create files. Start by discussing requirements with the user. Ask clarifying questions to refine the spec.

You have a tool called "ask_question" to ask the user clarifying questions. ALWAYS use this tool instead of asking questions in plain text. Provide 2-3 specific answer options for each question. The user can also write a custom response. Ask ONE question at a time — do not batch multiple questions into a single tool call.

You have a tool called "mark_ready" to signal that the planning is complete and the card is ready for development. Use it when the spec is finalized and you and the user agree it's ready. You can also include [READY_FOR_DEVELOPMENT] in your response text as a fallback.`;

/** Tools available to planning agents — read-only exploration only */
const PLANNING_TOOLS = ["Read", "Grep", "Glob", "Bash", "Agent"];
/** Tools explicitly blocked for planning agents */
const PLANNING_DISALLOWED_TOOLS = ["Edit", "Write", "NotebookEdit"];

const PROJECT_CHAT_SYSTEM_PROMPT = `You are a project assistant for a Kanban board. You can explore the codebase (read-only) and answer questions about the project.

You have a tool called "create_card" to add cards to the backlog. Use it when the user asks you to create tasks, features, or fixes. You may create multiple cards in one response.

Do NOT modify any files. Only use read-only tools (Read, Grep, Glob, Bash for read-only commands like ls, git log, etc).`;

class Orchestrator {
  private processes = new Map<string, ClaudeProcess>();
  private projectProcesses = new Map<string, ClaudeProcess>();
  private queue = new Map<string, string[]>();
  private streamingBuffers = new Map<string, {
    text: string;
    toolCounts: Map<string, number>;
    column: string;
  }>();

  getStreamingState(cardId: string) {
    const buf = this.streamingBuffers.get(cardId);
    if (!buf) return null;
    return {
      text: buf.text,
      toolCounts: Object.fromEntries(buf.toolCounts),
      column: buf.column,
    };
  }

  private log(cardId: string, content: string, column = "production") {
    console.log(`[orchestrator] log(${cardId}): ${content}`);
    const msg = {
      id: uuid(),
      cardId,
      role: "system",
      content,
      column,
      createdAt: new Date().toISOString(),
    };
    db.insert(chatMessages).values(msg).run();
    try {
      emitToCard(cardId, "agent:output", {
        cardId,
        type: "system",
        content,
        column,
        timestamp: msg.createdAt,
      });
    } catch {
      // Socket may not be available
    }
  }

  private getFilesContext(projectId: string, cardId?: string): string {
    const projectFiles = db
      .select()
      .from(files)
      .where(and(eq(files.projectId, projectId), isNull(files.cardId)))
      .all();

    const cardFiles = cardId
      ? db.select().from(files).where(eq(files.cardId, cardId)).all()
      : [];

    if (projectFiles.length === 0 && cardFiles.length === 0) return "";

    let context = "\n\n## Reference Files\n";
    context += "The user has uploaded reference files you can read with your Read tool:\n";

    if (projectFiles.length > 0) {
      context += "\nProject-level files:\n";
      projectFiles.forEach((f) => {
        context += `- ${f.filename} (${f.mimeType}) → ${f.storedPath}\n`;
      });
    }

    if (cardFiles.length > 0) {
      context += "\nCard-specific files:\n";
      cardFiles.forEach((f) => {
        context += `- ${f.filename} (${f.mimeType}) → ${f.storedPath}\n`;
      });
    }

    return context;
  }

  async sendMessage(cardId: string, message: string) {
    console.log(`[orchestrator] sendMessage(${cardId}): ${message.substring(0, 80)}...`);
    const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
    if (!card) throw new Error("Card not found");

    const project = db
      .select()
      .from(projects)
      .where(eq(projects.id, card.projectId))
      .get();
    if (!project) throw new Error("Project not found");

    // User message is now persisted by the API route before calling sendMessage,
    // so we no longer save it here (avoids duplicates and ensures persistence
    // even if later checks in this method throw).

    const proc = this.processes.get(cardId);

    // If process is already running, stop it first (SDK doesn't support mid-stream messages)
    if (proc?.isRunning) {
      console.log(`[orchestrator] Stopping running process for ${cardId} to send new message`);
      // Remove all listeners before stopping so the old process's async exit
      // handler doesn't clobber the new process we're about to spawn.
      proc.removeAllListeners();
      proc.stop();
      this.processes.delete(cardId);
    }

    // No running process — spawn one based on card state
    // If previous session errored out, clear stale session ID and start fresh
    const hasValidSession = card.claudeSessionId && card.agentStatus !== "error";

    if (card.column === "features") {
      if (!hasValidSession) {
        // First message or recovery from error: spawn new session
        const sessionId = uuid();
        db.update(cards)
          .set({ claudeSessionId: sessionId, agentStatus: "running", updatedAt: new Date().toISOString() })
          .where(eq(cards.id, cardId))
          .run();

        const todos = db.select().from(checklistItems).where(eq(checklistItems.cardId, cardId)).all();
        let cardContext = `\n\nCard title: ${card.title}`;
        if (card.description) cardContext += `\nCard description: ${card.description}`;
        if (todos.length > 0) {
          cardContext += `\n\nChecklist:\n${todos.map(t => `- [${t.checked ? "x" : " "}] ${t.text}`).join("\n")}`;
        }
        const filesContext = this.getFilesContext(card.projectId, cardId);
        const questionMcp = createQuestionMcpServer(cardId);
        this.spawnAgent(cardId, project.repoPath, message, {
          sessionId,
          systemPrompt: PLANNING_SYSTEM_PROMPT + cardContext + filesContext,
          column: "features",
          tools: PLANNING_TOOLS,
          disallowedTools: PLANNING_DISALLOWED_TOOLS,
          mcpServers: { "trellai-questions": questionMcp },
        });
      } else {
        // Resume existing session with the new message
        db.update(cards)
          .set({ agentStatus: "running", updatedAt: new Date().toISOString() })
          .where(eq(cards.id, cardId))
          .run();

        const questionMcpResume = createQuestionMcpServer(cardId);
        this.spawnAgent(cardId, project.repoPath, message, {
          resumeSessionId: card.claudeSessionId!,
          column: "features",
          tools: PLANNING_TOOLS,
          disallowedTools: PLANNING_DISALLOWED_TOOLS,
          mcpServers: { "trellai-questions": questionMcpResume },
        });
      }
    } else if (card.column === "production" && card.worktreePath) {
      if (hasValidSession) {
        db.update(cards)
          .set({ agentStatus: "running", updatedAt: new Date().toISOString() })
          .where(eq(cards.id, cardId))
          .run();

        this.spawnAgent(cardId, card.worktreePath, message, {
          resumeSessionId: card.claudeSessionId!,
          column: "production",
        });
      } else {
        const sessionId = uuid();
        db.update(cards)
          .set({ claudeSessionId: sessionId, agentStatus: "running", updatedAt: new Date().toISOString() })
          .where(eq(cards.id, cardId))
          .run();

        this.spawnAgent(cardId, card.worktreePath, message, {
          sessionId,
          column: "production",
        });
      }
    } else if (card.column === "production" && !card.worktreePath) {
      // Queue mode — agent works directly in the project repo
      const project2 = db.select().from(projects).where(eq(projects.id, card.projectId)).get();
      if (!project2) throw new Error("Project not found");

      if (hasValidSession) {
        db.update(cards)
          .set({ agentStatus: "running", updatedAt: new Date().toISOString() })
          .where(eq(cards.id, cardId))
          .run();

        this.spawnAgent(cardId, project2.repoPath, message, {
          resumeSessionId: card.claudeSessionId!,
          column: "production",
        });
      } else {
        const sessionId = uuid();
        db.update(cards)
          .set({ claudeSessionId: sessionId, agentStatus: "running", updatedAt: new Date().toISOString() })
          .where(eq(cards.id, cardId))
          .run();

        this.spawnAgent(cardId, project2.repoPath, message, {
          sessionId,
          column: "production",
        });
      }
    } else {
      throw new Error("Cannot send message to agent in this column");
    }

    try {
      emitToCard(cardId, "agent:status", { cardId, status: "running" });
    } catch {
      // Socket may not be available
    }
  }

  private spawnAgent(
    cardId: string,
    workDir: string,
    prompt: string,
    options: {
      sessionId?: string;
      resumeSessionId?: string;
      forkSession?: boolean;
      systemPrompt?: string;
      column: string;
      tools?: string[];
      disallowedTools?: string[];
      mcpServers?: Record<string, import("@anthropic-ai/claude-agent-sdk").McpSdkServerConfigWithInstance>;
    }
  ) {
    const proc = new ClaudeProcess();
    this.processes.set(cardId, proc);

    proc.on("output", (data) => {
      const content = data.content;
      console.log(`[orchestrator] output(${cardId}): type=${data.type} len=${content?.length}`);

      // Check for ready-for-development marker in features column
      if (options.column === "features" && data.type === "result" && content.includes("[READY_FOR_DEVELOPMENT]")) {
        const cleaned = content.replace(/\[READY_FOR_DEVELOPMENT\]/g, "").trim();

        // Persist the cleaned message
        if (cleaned) {
          db.insert(chatMessages)
            .values({
              id: uuid(),
              cardId,
              role: "assistant",
              content: cleaned,
              column: options.column,
              createdAt: new Date().toISOString(),
            })
            .run();

          try {
            emitToCard(cardId, "agent:output", {
              cardId,
              type: "result",
              content: cleaned,
              column: options.column,
              timestamp: new Date().toISOString(),
            });
          } catch {
            // Socket may not be available
          }
        }

        // Set ready_for_dev status — user confirms the move via UI
        db.update(cards)
          .set({ agentStatus: "ready_for_dev", updatedAt: new Date().toISOString() })
          .where(eq(cards.id, cardId))
          .run();
        try {
          emitToCard(cardId, "agent:status", { cardId, status: "ready_for_dev" });
        } catch {
          // Socket may not be available
        }

        this.log(cardId, "Planning complete — ready for development.", "features");
        return;
      }

      // Update streaming buffer for state reconstruction on reopen
      if (data.type === "tool_use") {
        const buf = this.streamingBuffers.get(cardId) || { text: "", toolCounts: new Map(), column: options.column };
        const toolName = data.content.replace("Using tool: ", "").trim();
        buf.toolCounts.set(toolName, (buf.toolCounts.get(toolName) || 0) + 1);
        buf.column = options.column;
        this.streamingBuffers.set(cardId, buf);
      } else if (data.type === "text") {
        const buf = this.streamingBuffers.get(cardId) || { text: "", toolCounts: new Map(), column: options.column };
        if (buf.toolCounts.size > 0) {
          // Group boundary: bake tool marker into text then reset counts
          const parts = Array.from(buf.toolCounts.entries()).map(([n, c]) => `${n}×${c}`);
          buf.text += `\n{{tools:${parts.join(",")}}}`;
          buf.toolCounts = new Map();
        }
        buf.text += data.content;
        buf.column = options.column;
        this.streamingBuffers.set(cardId, buf);
      } else if (data.type === "result") {
        this.streamingBuffers.delete(cardId);
      }

      // Emit via socket for real-time display
      try {
        emitToCard(cardId, "agent:output", {
          cardId,
          ...data,
          column: options.column,
          timestamp: new Date().toISOString(),
        });
      } catch {
        // Socket may not be available
      }

      // Only persist final results and system events to DB (not streaming deltas or tool_use)
      if (data.type === "result" || data.type === "system") {
        db.insert(chatMessages)
          .values({
            id: uuid(),
            cardId,
            role: data.type === "system" ? "system" : "assistant",
            content: data.content,
            column: options.column,
            createdAt: new Date().toISOString(),
          })
          .run();
      }
    });

    // Capture session_id from SDK (may differ from what we provided)
    proc.on("session", (data: { sessionId: string }) => {
      console.log(`[orchestrator] session(${cardId}): ${data.sessionId}`);
      db.update(cards)
        .set({ claudeSessionId: data.sessionId, updatedAt: new Date().toISOString() })
        .where(eq(cards.id, cardId))
        .run();
    });

    // Forward usage/rate-limit events globally
    proc.on("usage", (data) => {
      try {
        emitGlobal("usage:updated", data);
      } catch {
        // Socket may not be available
      }
    });

    proc.on("error", (error) => {
      console.error(`[orchestrator] error(${cardId}): ${error}`);
      this.log(cardId, `Agent error: ${error}`, options.column);
      try {
        emitToCard(cardId, "agent:error", { cardId, error, column: options.column });
      } catch {
        // Socket may not be available
      }
    });

    proc.on("exit", (code) => {
      console.log(`[orchestrator] exit(${cardId}): code=${code}`);
      this.processes.delete(cardId);
      this.streamingBuffers.delete(cardId);

      // Determine status based on column context
      const exitCard = db.select().from(cards).where(eq(cards.id, cardId)).get();
      let newStatus: string;
      if (code !== 0) {
        newStatus = "error";
      } else if (options.column === "features") {
        // Don't overwrite ready_for_dev — it was set intentionally by agent
        newStatus = exitCard?.agentStatus === "ready_for_dev" ? "ready_for_dev" : "awaiting_feedback";
      } else if (options.column === "production") {
        newStatus = "dev_complete";
      } else {
        newStatus = "idle";
      }

      // Queue mode auto-commit on successful production exit
      const currentCard = db.select().from(cards).where(eq(cards.id, cardId)).get();
      if (options.column === "production" && currentCard && !currentCard.worktreePath) {
        const proj = db.select().from(projects).where(eq(projects.id, currentCard.projectId)).get();
        if (proj && code === 0) {
          try {
            const { sha } = queueManager.commitChanges(proj.repoPath, currentCard.title, cardId);
            db.update(cards)
              .set({ commitSha: sha, agentStatus: "dev_complete", updatedAt: new Date().toISOString() })
              .where(eq(cards.id, cardId))
              .run();
            this.log(cardId, `Auto-committed changes: \`${sha.substring(0, 8)}\``);
            newStatus = "dev_complete";
          } catch (err) {
            console.error(`[orchestrator] Auto-commit failed for ${cardId}:`, err);
            newStatus = "error";
            this.log(cardId, `Auto-commit failed: ${err instanceof Error ? err.message : String(err)}`);
            db.update(cards)
              .set({ agentStatus: newStatus, updatedAt: new Date().toISOString() })
              .where(eq(cards.id, cardId))
              .run();
          }
        } else {
          db.update(cards)
            .set({ agentStatus: newStatus, updatedAt: new Date().toISOString() })
            .where(eq(cards.id, cardId))
            .run();
        }
        // Process next queued card regardless of success/failure
        if (proj) this.processNextInQueue(proj.id);
      } else {
        db.update(cards)
          .set({ agentStatus: newStatus, updatedAt: new Date().toISOString() })
          .where(eq(cards.id, cardId))
          .run();
      }

      // Only show exit messages for errors, not normal completion
      if (code !== 0) {
        this.log(cardId, `Agent exited with code ${code}.`, options.column);
      }

      try {
        emitToCard(cardId, "agent:status", {
          cardId,
          status: newStatus,
          code,
          column: options.column,
        });
      } catch {
        // Socket may not be available
      }
    });

    proc.spawn(workDir, prompt, {
      sessionId: options.sessionId,
      resumeSessionId: options.resumeSessionId,
      forkSession: options.forkSession,
      systemPrompt: options.systemPrompt,
      tools: options.tools,
      disallowedTools: options.disallowedTools,
      mcpServers: options.mcpServers,
    });
  }

  private async handleAutoMoveToProduction(cardId: string) {
    try {
      await this.onMoveToProduction(cardId);

      try {
        emitToCard(cardId, "card:auto-move", {
          cardId,
          column: "production",
        });
      } catch {
        // Socket may not be available
      }
    } catch (err) {
      this.log(
        cardId,
        `Failed to auto-move to production: ${err instanceof Error ? err.message : String(err)}`,
        "features"
      );
    }
  }

  async confirmMoveToDev(cardId: string) {
    const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
    if (!card) throw new Error("Card not found");
    if (card.column !== "features") {
      throw new Error("Card is not in the features column");
    }

    // Show ready_for_dev status while worktree is being created
    db.update(cards)
      .set({ agentStatus: "ready_for_dev", updatedAt: new Date().toISOString() })
      .where(eq(cards.id, cardId))
      .run();
    try {
      emitToCard(cardId, "agent:status", { cardId, status: "ready_for_dev" });
    } catch {
      // Socket may not be available
    }

    this.log(cardId, "Moving to development. Creating worktree...", "features");
    await this.handleAutoMoveToProduction(cardId);
  }

  async onMoveToProduction(cardId: string) {
    const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
    if (!card) throw new Error("Card not found");

    const project = db
      .select()
      .from(projects)
      .where(eq(projects.id, card.projectId))
      .get();
    if (!project) throw new Error("Project not found");

    if (project.mode === "queue") {
      return this.onMoveToProductionQueue(cardId, card, project);
    }

    return this.onMoveToProductionWorktree(cardId, card, project);
  }

  private async onMoveToProductionQueue(
    cardId: string,
    card: typeof cards.$inferSelect,
    project: typeof projects.$inferSelect
  ) {
    // Stop the existing planning process if running
    const existingProc = this.processes.get(cardId);
    if (existingProc?.isRunning) {
      existingProc.removeAllListeners();
      existingProc.stop();
      this.processes.delete(cardId);
    }

    if (!existsSync(project.repoPath)) {
      throw new Error(`Project repo path does not exist: ${project.repoPath}`);
    }

    // Check if another card in this project is already running in production
    const runningCards = db
      .select()
      .from(cards)
      .where(
        and(
          eq(cards.projectId, project.id),
          eq(cards.column, "production"),
          eq(cards.agentStatus, "running"),
          ne(cards.id, cardId)
        )
      )
      .all();

    if (runningCards.length > 0) {
      // Queue this card
      db.update(cards)
        .set({
          column: "production",
          agentStatus: "queued",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(cards.id, cardId))
        .run();

      const q = this.queue.get(project.id) || [];
      q.push(cardId);
      this.queue.set(project.id, q);

      this.log(cardId, "Queued — waiting for current agent to finish.");
      try {
        emitToCard(cardId, "agent:status", { cardId, status: "queued" });
      } catch {
        // Socket may not be available
      }
      return;
    }

    // Start the agent directly in the project repo
    const planningSessionId = card.claudeSessionId;
    const sessionId = uuid();

    db.update(cards)
      .set({
        column: "production",
        agentStatus: "running",
        claudeSessionId: sessionId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(cards.id, cardId))
      .run();

    const planningMessages = db.select()
      .from(chatMessages)
      .where(and(eq(chatMessages.cardId, cardId), eq(chatMessages.column, "features")))
      .all();

    let planningContext = "";
    if (planningMessages.length > 0) {
      const conversation = planningMessages
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => `${m.role}: ${m.content}`)
        .join("\n\n");
      planningContext = `\n\nPlanning discussion:\n${conversation}`;
    }

    const filesContext = this.getFilesContext(card.projectId, cardId);
    const handoffMessage = `You are working directly in the repository at ${project.repoPath} on the current branch (queue mode — no worktree). Implement the feature described below. All changes will be auto-committed when you're done.

Card: ${card.title}
${card.description ? `Description: ${card.description}` : ""}${planningContext}${filesContext}`;

    this.log(cardId, "Agent started in queue mode (no worktree).");
    this.spawnAgent(cardId, project.repoPath, handoffMessage, {
      sessionId,
      column: "production",
    });

    try {
      emitToCard(cardId, "agent:status", { cardId, status: "running" });
    } catch {
      // Socket may not be available
    }
  }

  private async onMoveToProductionWorktree(
    cardId: string,
    card: typeof cards.$inferSelect,
    project: typeof projects.$inferSelect
  ) {
    // Stop the existing planning process if running
    const existingProc = this.processes.get(cardId);
    if (existingProc?.isRunning) {
      existingProc.removeAllListeners();
      existingProc.stop();
      this.processes.delete(cardId);
    }

    // Create branch name from card title
    const branchName = `trellai/${card.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 40)}-${cardId.substring(0, 8)}`;

    if (!existsSync(project.repoPath)) {
      throw new Error(`Project repo path does not exist: ${project.repoPath}`);
    }

    this.log(cardId, `Creating worktree on branch \`${branchName}\`...`);

    // Create worktree
    const { worktreePath } = worktreeManager.createWorktree(
      project.repoPath,
      branchName
    );

    this.log(cardId, `Worktree ready at \`${worktreePath}\``);

    // Capture the planning session ID before we overwrite it
    const planningSessionId = card.claudeSessionId;

    // Build conflict awareness
    const otherCards = db
      .select()
      .from(cards)
      .where(
        and(
          eq(cards.column, "production"),
          ne(cards.id, cardId)
        )
      )
      .all();

    let conflictWarning = "";
    const filesByBranch: Record<string, string[]> = {};
    for (const other of otherCards) {
      if (other.branchName) {
        const files = worktreeManager.getModifiedFiles(
          project.repoPath,
          other.branchName
        );
        if (files.length > 0) {
          filesByBranch[other.branchName] = files;
        }
      }
    }

    if (Object.keys(filesByBranch).length > 0) {
      const lines = Object.entries(filesByBranch).map(
        ([branch, files]) => `  ${branch}: ${files.join(", ")}`
      );
      conflictWarning = `\n\nIMPORTANT: Other agents are currently working on these files. Do not modify these files to avoid merge conflicts:\n${lines.join("\n")}\n`;
    }

    // Try to copy the planning session to the worktree's project dir so we
    // can fork it — this preserves full context without re-pasting tokens.
    let sessionCopied = false;
    if (planningSessionId) {
      try {
        sessionCopied = copySessionToProject(
          planningSessionId,
          project.repoPath,
          worktreePath
        );
      } catch (err) {
        console.error(
          `[orchestrator] Session copy failed, falling back to text-paste:`,
          err
        );
      }
    }

    if (sessionCopied && planningSessionId) {
      db.update(cards)
        .set({
          column: "production",
          branchName,
          worktreePath,
          agentStatus: "running",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(cards.id, cardId))
        .run();

      const filesContextForked = this.getFilesContext(card.projectId, cardId);
      const handoffMessage = `You are now in a development worktree at ${worktreePath} on branch ${branchName}. Your planning discussion is preserved in this session — proceed to implement the feature.${conflictWarning}${filesContextForked}`;

      this.log(cardId, "Session forked to development environment.");
      this.spawnAgent(cardId, worktreePath, handoffMessage, {
        resumeSessionId: planningSessionId,
        forkSession: true,
        column: "production",
      });
    } else {
      const sessionId = uuid();

      db.update(cards)
        .set({
          column: "production",
          branchName,
          worktreePath,
          claudeSessionId: sessionId,
          agentStatus: "running",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(cards.id, cardId))
        .run();

      const planningMessages = db.select()
        .from(chatMessages)
        .where(and(eq(chatMessages.cardId, cardId), eq(chatMessages.column, "features")))
        .all();

      let planningContext = "";
      if (planningMessages.length > 0) {
        const conversation = planningMessages
          .filter(m => m.role === "user" || m.role === "assistant")
          .map(m => `${m.role}: ${m.content}`)
          .join("\n\n");
        planningContext = `\n\nPlanning discussion:\n${conversation}`;
      }

      const filesContextNew = this.getFilesContext(card.projectId, cardId);
      const handoffMessage = `You are now in a development worktree at ${worktreePath} on branch ${branchName}. Implement the feature based on the planning discussion below.${conflictWarning}${planningContext}${filesContextNew}`;

      this.log(cardId, "Session transferred to development environment.");
      this.spawnAgent(cardId, worktreePath, handoffMessage, {
        sessionId,
        column: "production",
      });
    }

    try {
      emitToCard(cardId, "agent:status", { cardId, status: "running" });
    } catch {
      // Socket may not be available
    }
  }

  async onMoveToReview(cardId: string) {
    // Stop agent if still running
    const proc = this.processes.get(cardId);
    if (proc?.isRunning) {
      proc.stop();
    }
    this.processes.delete(cardId);

    const card = db.select().from(cards).where(eq(cards.id, cardId)).get();

    // Queue mode: auto-commit any uncommitted changes
    if (card && !card.worktreePath) {
      const project = db.select().from(projects).where(eq(projects.id, card.projectId)).get();
      if (project && queueManager.hasUncommittedChanges(project.repoPath)) {
        try {
          const { sha } = queueManager.commitChanges(project.repoPath, card.title, cardId);
          db.update(cards)
            .set({ commitSha: sha, updatedAt: new Date().toISOString() })
            .where(eq(cards.id, cardId))
            .run();
          this.log(cardId, `Auto-committed changes: \`${sha.substring(0, 8)}\``);
        } catch (err) {
          console.error(`[orchestrator] Auto-commit on review failed for ${cardId}:`, err);
        }
      }
      // Process next queued card
      if (project) this.processNextInQueue(project.id);
    }

    db.update(cards)
      .set({
        agentStatus: "complete",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(cards.id, cardId))
      .run();
  }

  async onMoveToComplete(cardId: string) {
    const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
    if (!card) return;

    const project = db
      .select()
      .from(projects)
      .where(eq(projects.id, card.projectId))
      .get();
    if (!project) return;

    // Queue mode — work is already committed on main, just mark done
    if (!card.branchName && card.commitSha) {
      db.insert(chatMessages)
        .values({
          id: uuid(),
          cardId,
          role: "system",
          content: `Approved. Commit \`${card.commitSha.substring(0, 8)}\` is already on main.`,
          column: "complete",
          createdAt: new Date().toISOString(),
        })
        .run();

      db.update(cards)
        .set({
          agentStatus: "merged",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(cards.id, cardId))
        .run();
      return;
    }

    // Worktree mode — merge branch
    if (!card.branchName) return;

    const result = worktreeManager.mergeBranch(
      project.repoPath,
      card.branchName
    );

    if (!result.success) {
      db.update(cards)
        .set({
          column: "review",
          agentStatus: "error",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(cards.id, cardId))
        .run();

      db.insert(chatMessages)
        .values({
          id: uuid(),
          cardId,
          role: "system",
          content: `Merge failed: ${result.error}`,
          column: "review",
          createdAt: new Date().toISOString(),
        })
        .run();

      throw new Error(`Merge failed: ${result.error}`);
    }

    db.insert(chatMessages)
      .values({
        id: uuid(),
        cardId,
        role: "system",
        content: `Branch \`${card.branchName}\` merged successfully.`,
        column: "complete",
        createdAt: new Date().toISOString(),
      })
      .run();

    if (card.worktreePath) {
      worktreeManager.deleteWorktree(
        project.repoPath,
        card.worktreePath,
        card.branchName
      );
    }

    db.update(cards)
      .set({
        agentStatus: "merged",
        worktreePath: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(cards.id, cardId))
      .run();
  }

  async onMoveToFeatures(cardId: string) {
    // Stop agent if running
    const proc = this.processes.get(cardId);
    if (proc?.isRunning) {
      proc.stop();
    }
    this.processes.delete(cardId);

    const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
    if (!card) return;

    // Remove from queue if queued
    const project = db
      .select()
      .from(projects)
      .where(eq(projects.id, card.projectId))
      .get();

    if (project) {
      const q = this.queue.get(project.id);
      if (q) {
        const idx = q.indexOf(cardId);
        if (idx !== -1) q.splice(idx, 1);
      }
    }

    // Clean up worktree if exists (worktree mode)
    if (card.worktreePath && card.branchName && project) {
      worktreeManager.deleteWorktree(
        project.repoPath,
        card.worktreePath,
        card.branchName
      );
    }

    db.update(cards)
      .set({
        agentStatus: "idle",
        branchName: null,
        worktreePath: null,
        claudeSessionId: null,
        commitSha: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(cards.id, cardId))
      .run();

    // Process next queued card if there was one waiting
    if (project) this.processNextInQueue(project.id);
  }

  private processNextInQueue(projectId: string) {
    const q = this.queue.get(projectId) || [];
    if (q.length === 0) {
      // Also check DB for queued cards (in case queue was lost on hot reload)
      const queuedCards = db
        .select()
        .from(cards)
        .where(
          and(
            eq(cards.projectId, projectId),
            eq(cards.agentStatus, "queued"),
            eq(cards.column, "production")
          )
        )
        .all()
        .sort((a, b) => a.position - b.position);

      if (queuedCards.length === 0) return;

      // Rebuild queue from DB
      for (const c of queuedCards) {
        q.push(c.id);
      }
      this.queue.set(projectId, q);
    }

    // Check no other card is currently running in production for this project
    const runningCards = db
      .select()
      .from(cards)
      .where(
        and(
          eq(cards.projectId, projectId),
          eq(cards.column, "production"),
          eq(cards.agentStatus, "running")
        )
      )
      .all();

    if (runningCards.length > 0) return;

    const nextCardId = q.shift()!;
    const nextCard = db.select().from(cards).where(eq(cards.id, nextCardId)).get();
    if (!nextCard || nextCard.column !== "production") return;

    const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) return;

    // Start the queued card
    const sessionId = uuid();
    db.update(cards)
      .set({
        agentStatus: "running",
        claudeSessionId: sessionId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(cards.id, nextCardId))
      .run();

    const planningMessages = db.select()
      .from(chatMessages)
      .where(and(eq(chatMessages.cardId, nextCardId), eq(chatMessages.column, "features")))
      .all();

    let planningContext = "";
    if (planningMessages.length > 0) {
      const conversation = planningMessages
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => `${m.role}: ${m.content}`)
        .join("\n\n");
      planningContext = `\n\nPlanning discussion:\n${conversation}`;
    }

    const queueFilesContext = this.getFilesContext(project.id, nextCardId);
    const handoffMessage = `You are working directly in the repository at ${project.repoPath} on the current branch (queue mode — no worktree). Implement the feature described below. All changes will be auto-committed when you're done.

Card: ${nextCard.title}
${nextCard.description ? `Description: ${nextCard.description}` : ""}${planningContext}${queueFilesContext}`;

    this.log(nextCardId, "Queue slot available — agent started.");
    this.spawnAgent(nextCardId, project.repoPath, handoffMessage, {
      sessionId,
      column: "production",
    });

    try {
      emitToCard(nextCardId, "agent:status", { cardId: nextCardId, status: "running" });
    } catch {
      // Socket may not be available
    }
  }

  async revertCard(cardId: string) {
    const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
    if (!card || !card.commitSha) throw new Error("Card has no commit to revert");

    const project = db.select().from(projects).where(eq(projects.id, card.projectId)).get();
    if (!project) throw new Error("Project not found");

    const result = queueManager.revertCommit(project.repoPath, card.commitSha);
    if (!result.success) {
      throw new Error(`Revert failed: ${result.error}`);
    }

    db.update(cards)
      .set({
        agentStatus: "reverted",
        commitSha: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(cards.id, cardId))
      .run();

    this.log(cardId, `Reverted commit \`${card.commitSha.substring(0, 8)}\`.`, card.column);

    try {
      emitToCard(cardId, "agent:status", { cardId, status: "reverted" });
    } catch {
      // Socket may not be available
    }
  }

  getAgentStatus(cardId: string): { running: boolean } {
    const proc = this.processes.get(cardId);
    if (proc?.isRunning) return { running: true };

    // Fallback: check DB status (process map may be lost on hot-reload)
    const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
    return { running: card?.agentStatus === "running" };
  }

  stopAgent(cardId: string) {
    const proc = this.processes.get(cardId);
    if (proc) {
      proc.stop();
      this.processes.delete(cardId);
    }
  }

  // ── Project Chat ──────────────────────────────────────────────────────

  private logProject(projectId: string, content: string) {
    console.log(`[orchestrator] logProject(${projectId}): ${content}`);
    const msg = {
      id: uuid(),
      cardId: null,
      projectId,
      role: "system",
      content,
      column: "project",
      createdAt: new Date().toISOString(),
    };
    db.insert(chatMessages).values(msg).run();
    try {
      emitToProject(projectId, "agent:output", {
        projectId,
        type: "system",
        content,
        timestamp: msg.createdAt,
      });
    } catch {
      // Socket may not be available
    }
  }

  async sendProjectMessage(projectId: string, message: string) {
    console.log(`[orchestrator] sendProjectMessage(${projectId}): ${message.substring(0, 80)}...`);
    const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) throw new Error("Project not found");

    // Save user message
    db.insert(chatMessages)
      .values({
        id: uuid(),
        cardId: null,
        projectId,
        role: "user",
        content: message,
        column: "project",
        createdAt: new Date().toISOString(),
      })
      .run();

    // Stop existing process if running
    const proc = this.projectProcesses.get(projectId);
    if (proc?.isRunning) {
      proc.stop();
      this.projectProcesses.delete(projectId);
    }

    const hasValidSession = !!project.chatSessionId;

    if (!hasValidSession) {
      const sessionId = uuid();
      db.update(projects)
        .set({ chatSessionId: sessionId })
        .where(eq(projects.id, projectId))
        .run();

      const projectFilesContext = this.getFilesContext(projectId);
      this.spawnProjectAgent(projectId, project.repoPath, message, {
        sessionId,
        systemPrompt: PROJECT_CHAT_SYSTEM_PROMPT + projectFilesContext,
      });
    } else {
      this.spawnProjectAgent(projectId, project.repoPath, message, {
        resumeSessionId: project.chatSessionId!,
      });
    }

    try {
      emitToProject(projectId, "agent:status", { projectId, status: "running" });
    } catch {
      // Socket may not be available
    }
  }

  private spawnProjectAgent(
    projectId: string,
    workDir: string,
    prompt: string,
    options: {
      sessionId?: string;
      resumeSessionId?: string;
      systemPrompt?: string;
    }
  ) {
    const proc = new ClaudeProcess();
    this.projectProcesses.set(projectId, proc);

    proc.on("output", (data) => {
      const content = data.content;
      console.log(`[orchestrator] projectOutput(${projectId}): type=${data.type} len=${content?.length}`);

      // Emit via socket for real-time display
      try {
        emitToProject(projectId, "agent:output", {
          projectId,
          ...data,
          timestamp: new Date().toISOString(),
        });
      } catch {
        // Socket may not be available
      }

      // Persist final results and system events (not tool_use)
      if (data.type === "result" || data.type === "system") {
        db.insert(chatMessages)
          .values({
            id: uuid(),
            cardId: null,
            projectId,
            role: data.type === "system" ? "system" : "assistant",
            content: data.content,
            column: "project",
            createdAt: new Date().toISOString(),
          })
          .run();
      }
    });

    proc.on("session", (data: { sessionId: string }) => {
      console.log(`[orchestrator] projectSession(${projectId}): ${data.sessionId}`);
      db.update(projects)
        .set({ chatSessionId: data.sessionId })
        .where(eq(projects.id, projectId))
        .run();
    });

    // Forward usage/rate-limit events globally
    proc.on("usage", (data) => {
      try {
        emitGlobal("usage:updated", data);
      } catch {
        // Socket may not be available
      }
    });

    proc.on("error", (error) => {
      console.error(`[orchestrator] projectError(${projectId}): ${error}`);
      this.logProject(projectId, `Agent error: ${error}`);
      try {
        emitToProject(projectId, "agent:error", { projectId, error });
      } catch {
        // Socket may not be available
      }
    });

    proc.on("exit", (code) => {
      console.log(`[orchestrator] projectExit(${projectId}): code=${code}`);
      this.projectProcesses.delete(projectId);

      if (code !== 0) {
        this.logProject(projectId, `Agent exited with code ${code}.`);
        // Clear session on error so next message starts fresh
        db.update(projects)
          .set({ chatSessionId: null })
          .where(eq(projects.id, projectId))
          .run();
      }

      try {
        emitToProject(projectId, "agent:status", {
          projectId,
          status: code === 0 ? "idle" : "error",
          code,
        });
      } catch {
        // Socket may not be available
      }
    });

    // Create project-scoped MCP server with board tools (e.g. create_card)
    const boardMcp = createBoardMcpServer(projectId);

    proc.spawn(workDir, prompt, {
      sessionId: options.sessionId,
      resumeSessionId: options.resumeSessionId,
      systemPrompt: options.systemPrompt,
      mcpServers: { "trellai-board": boardMcp },
    });
  }

  getProjectAgentStatus(projectId: string): { running: boolean } {
    const proc = this.projectProcesses.get(projectId);
    return { running: !!proc?.isRunning };
  }

  stopProjectAgent(projectId: string) {
    const proc = this.projectProcesses.get(projectId);
    if (proc) {
      proc.stop();
      this.projectProcesses.delete(projectId);
    }
  }

  async clearProjectChat(projectId: string) {
    this.stopProjectAgent(projectId);

    // Delete all project-level chat messages
    db.delete(chatMessages)
      .where(
        and(
          eq(chatMessages.projectId, projectId),
        )
      )
      .run();

    // Clear session ID
    db.update(projects)
      .set({ chatSessionId: null })
      .where(eq(projects.id, projectId))
      .run();
  }
}

// Survive Next.js hot module reloads in dev mode
// Always create a new instance so prototype changes are picked up,
// but transfer running processes from the old instance if it exists.
const globalForOrchestrator = globalThis as unknown as { orchestrator?: Orchestrator; _processes?: Map<string, ClaudeProcess>; _projectProcesses?: Map<string, ClaudeProcess>; _queue?: Map<string, string[]> };

const freshOrchestrator = new Orchestrator();
if (globalForOrchestrator._processes) {
  (freshOrchestrator as unknown as { processes: Map<string, ClaudeProcess> }).processes = globalForOrchestrator._processes;
}
if (globalForOrchestrator._projectProcesses) {
  (freshOrchestrator as unknown as { projectProcesses: Map<string, ClaudeProcess> }).projectProcesses = globalForOrchestrator._projectProcesses;
}
if (globalForOrchestrator._queue) {
  (freshOrchestrator as unknown as { queue: Map<string, string[]> }).queue = globalForOrchestrator._queue;
}
// Store process maps on globalThis so they survive across reloads
globalForOrchestrator._processes = (freshOrchestrator as unknown as { processes: Map<string, ClaudeProcess> }).processes;
globalForOrchestrator._projectProcesses = (freshOrchestrator as unknown as { projectProcesses: Map<string, ClaudeProcess> }).projectProcesses;
globalForOrchestrator._queue = (freshOrchestrator as unknown as { queue: Map<string, string[]> }).queue;
globalForOrchestrator.orchestrator = freshOrchestrator;
export const orchestrator = freshOrchestrator;
