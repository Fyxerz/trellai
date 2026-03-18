import { getLocalRepositories } from "@/lib/db/repositories";
import type { RepositoryContext, CardRow, ProjectRow } from "@/lib/db/repositories";
import { worktreeManager } from "./worktree-manager";
import { queueManager } from "./queue-manager";
import { ClaudeProcess } from "./claude-process";
import { v4 as uuid } from "uuid";
import { existsSync } from "fs";
import { emitToCard, emitToProject, emitGlobal } from "@/lib/socket";
import { copySessionToProject } from "./session-transfer";
import { createBoardMcpServer, createQuestionMcpServer, createDevMcpServer } from "./mcp-tools";

const repos: RepositoryContext = getLocalRepositories();

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
    segments: Array<{ kind: string; content: string; toolName?: string; input?: string; tools?: Array<{ name: string; count: number }> }>;
    thinkingBuffer: string;
    column: string;
  }>();

  getStreamingState(cardId: string) {
    const buf = this.streamingBuffers.get(cardId);
    if (!buf) return null;
    return {
      text: buf.text,
      toolCounts: Object.fromEntries(buf.toolCounts),
      segments: buf.segments,
      column: buf.column,
    };
  }

  private getOrCreateBuffer(cardId: string, column: string) {
    let buf = this.streamingBuffers.get(cardId);
    if (!buf) {
      buf = { text: "", toolCounts: new Map(), segments: [], thinkingBuffer: "", column };
      this.streamingBuffers.set(cardId, buf);
    }
    buf.column = column;
    return buf;
  }

  private flushThinkingBuffer(cardId: string, column: string) {
    const buf = this.streamingBuffers.get(cardId);
    if (!buf || !buf.thinkingBuffer) return;
    const thinking = buf.thinkingBuffer;
    buf.thinkingBuffer = "";
    // Persist thinking to DB
    repos.chatMessages.create({
      id: uuid(),
      cardId,
      projectId: null,
      role: "assistant",
      content: thinking,
      column,
      messageType: "thinking",
      createdAt: new Date().toISOString(),
    });
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
    repos.chatMessages.create({ ...msg, projectId: null, messageType: null } as { id: string; cardId: string | null; projectId: string | null; role: string; content: string; column: string; messageType: string | null; createdAt: string });
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
    const projectFiles = repos.files.findByProjectId(projectId);

    const cardFiles = cardId
      ? repos.files.findByCardId(cardId)
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
    const card = repos.cards.findById(cardId);
    if (!card) throw new Error("Card not found");

    const project = repos.projects.findById(card.projectId);
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
        repos.cards.update(cardId, { claudeSessionId: sessionId, agentStatus: "running", updatedAt: new Date().toISOString() });

        const todos = repos.checklistItems.findByCardId(cardId);
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
        repos.cards.update(cardId, { agentStatus: "running", updatedAt: new Date().toISOString() });

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
      const devMcpMsg1 = createDevMcpServer(cardId);
      if (hasValidSession) {
        repos.cards.update(cardId, { agentStatus: "running", updatedAt: new Date().toISOString() });

        this.spawnAgent(cardId, card.worktreePath, message, {
          resumeSessionId: card.claudeSessionId!,
          column: "production",
          mcpServers: { "trellai-dev": devMcpMsg1 },
        });
      } else {
        const sessionId = uuid();
        repos.cards.update(cardId, { claudeSessionId: sessionId, agentStatus: "running", updatedAt: new Date().toISOString() });

        this.spawnAgent(cardId, card.worktreePath, message, {
          sessionId,
          column: "production",
          mcpServers: { "trellai-dev": devMcpMsg1 },
        });
      }
    } else if (card.column === "production" && !card.worktreePath) {
      // Queue mode — agent works directly in the project repo
      const project2 = repos.projects.findById(card.projectId);
      if (!project2) throw new Error("Project not found");
      const devMcpMsg2 = createDevMcpServer(cardId);

      if (hasValidSession) {
        repos.cards.update(cardId, { agentStatus: "running", updatedAt: new Date().toISOString() });

        this.spawnAgent(cardId, project2.repoPath, message, {
          resumeSessionId: card.claudeSessionId!,
          column: "production",
          mcpServers: { "trellai-dev": devMcpMsg2 },
        });
      } else {
        const sessionId = uuid();
        repos.cards.update(cardId, { claudeSessionId: sessionId, agentStatus: "running", updatedAt: new Date().toISOString() });

        this.spawnAgent(cardId, project2.repoPath, message, {
          sessionId,
          column: "production",
          mcpServers: { "trellai-dev": devMcpMsg2 },
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
          repos.chatMessages.create({
              id: uuid(),
              cardId,
              role: "assistant",
              content: cleaned,
              column: options.column,
              projectId: null,
              messageType: null,
              createdAt: new Date().toISOString(),
            });

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
        repos.cards.update(cardId, { agentStatus: "ready_for_dev", updatedAt: new Date().toISOString() });
        try {
          emitToCard(cardId, "agent:status", { cardId, status: "ready_for_dev" });
        } catch {
          // Socket may not be available
        }

        this.log(cardId, "Planning complete — ready for development.", "features");
        return;
      }

      // Update streaming buffer for state reconstruction on reopen
      const buf = this.getOrCreateBuffer(cardId, options.column);

      if (data.type === "thinking") {
        buf.thinkingBuffer += data.content;
        // Add/update thinking segment
        const lastSeg = buf.segments[buf.segments.length - 1];
        if (lastSeg && lastSeg.kind === "thinking") {
          lastSeg.content += data.content;
        } else {
          buf.segments.push({ kind: "thinking", content: data.content });
        }
      } else if (data.type === "tool_use") {
        // Flush any pending thinking before tool use
        this.flushThinkingBuffer(cardId, options.column);
        const toolName = (data.toolName || data.content.replace("Using tool: ", "")).trim();
        buf.toolCounts.set(toolName, (buf.toolCounts.get(toolName) || 0) + 1);
        buf.segments.push({ kind: "tool_use", content: data.content, toolName, input: "" });
      } else if (data.type === "tool_input") {
        // Update the last tool_use segment with input details
        const lastToolSeg = [...buf.segments].reverse().find(s => s.kind === "tool_use");
        if (lastToolSeg) {
          lastToolSeg.input = data.content;
        }
        // Persist tool input
        repos.chatMessages.create({
            id: uuid(),
            cardId,
            role: "assistant",
            content: data.content,
            column: options.column,
            messageType: "tool_input",
            projectId: null,
              createdAt: new Date().toISOString(),
          });
      } else if (data.type === "tool_result") {
        buf.segments.push({ kind: "tool_result", content: data.content, toolName: data.toolName || "unknown" });
        // Persist tool result
        repos.chatMessages.create({
            id: uuid(),
            cardId,
            role: "assistant",
            content: data.content,
            column: options.column,
            messageType: "tool_result",
            projectId: null,
              createdAt: new Date().toISOString(),
          });
      } else if (data.type === "tool_summary") {
        // Persist tool summary
        repos.chatMessages.create({
            id: uuid(),
            cardId,
            role: "assistant",
            content: data.content,
            column: options.column,
            messageType: "tool_summary",
            projectId: null,
              createdAt: new Date().toISOString(),
          });
      } else if (data.type === "text") {
        // Flush any pending thinking before text output
        this.flushThinkingBuffer(cardId, options.column);
        buf.text += data.content;
        const lastSeg = buf.segments[buf.segments.length - 1];
        if (lastSeg && lastSeg.kind === "text") {
          lastSeg.content += data.content;
        } else {
          buf.segments.push({ kind: "text", content: data.content });
        }
      } else if (data.type === "result") {
        // Flush remaining thinking buffer
        this.flushThinkingBuffer(cardId, options.column);
        this.streamingBuffers.delete(cardId);
        // Persist final result
        if (data.content) {
          repos.chatMessages.create({
              id: uuid(),
              cardId,
              role: "assistant",
              content: data.content,
              column: options.column,
              messageType: null,
              projectId: null,
              createdAt: new Date().toISOString(),
            });
        }
      } else if (data.type === "system") {
        repos.chatMessages.create({
            id: uuid(),
            cardId,
            role: "system",
            content: data.content,
            column: options.column,
            messageType: null,
            projectId: null,
              createdAt: new Date().toISOString(),
          });
      }

      // Emit via socket for real-time display (all types)
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
    });

    // Capture session_id from SDK (may differ from what we provided)
    proc.on("session", (data: { sessionId: string }) => {
      console.log(`[orchestrator] session(${cardId}): ${data.sessionId}`);
      repos.cards.update(cardId, { claudeSessionId: data.sessionId, updatedAt: new Date().toISOString() });
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
      // Flush any remaining thinking buffer before cleanup
      this.flushThinkingBuffer(cardId, options.column);
      this.streamingBuffers.delete(cardId);

      // Determine status based on column context
      const exitCard = repos.cards.findById(cardId);
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
      const currentCard = repos.cards.findById(cardId);
      if (options.column === "production" && currentCard && !currentCard.worktreePath) {
        const proj = repos.projects.findById(currentCard.projectId);
        if (proj && code === 0) {
          try {
            const { sha } = queueManager.commitChanges(proj.repoPath, currentCard.title, cardId);
            repos.cards.update(cardId, { commitSha: sha, agentStatus: "dev_complete", updatedAt: new Date().toISOString() });
            this.log(cardId, `Auto-committed changes: \`${sha.substring(0, 8)}\``);
            newStatus = "dev_complete";
          } catch (err) {
            console.error(`[orchestrator] Auto-commit failed for ${cardId}:`, err);
            newStatus = "error";
            this.log(cardId, `Auto-commit failed: ${err instanceof Error ? err.message : String(err)}`);
            repos.cards.update(cardId, { agentStatus: newStatus, updatedAt: new Date().toISOString() });
          }
        } else {
          repos.cards.update(cardId, { agentStatus: newStatus, updatedAt: new Date().toISOString() });
        }
        // Process next queued card regardless of success/failure
        if (proj) this.processNextInQueue(proj.id);
      } else {
        repos.cards.update(cardId, { agentStatus: newStatus, updatedAt: new Date().toISOString() });
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
    const card = repos.cards.findById(cardId);
    if (!card) throw new Error("Card not found");
    if (card.column !== "features") {
      throw new Error("Card is not in the features column");
    }

    // Show ready_for_dev status while worktree is being created
    repos.cards.update(cardId, { agentStatus: "ready_for_dev", updatedAt: new Date().toISOString() });
    try {
      emitToCard(cardId, "agent:status", { cardId, status: "ready_for_dev" });
    } catch {
      // Socket may not be available
    }

    this.log(cardId, "Moving to development. Creating worktree...", "features");
    await this.handleAutoMoveToProduction(cardId);
  }

  async onMoveToProduction(cardId: string) {
    const card = repos.cards.findById(cardId);
    if (!card) throw new Error("Card not found");

    const project = repos.projects.findById(card.projectId);
    if (!project) throw new Error("Project not found");

    if (project.mode === "queue") {
      return this.onMoveToProductionQueue(cardId, card, project);
    }

    return this.onMoveToProductionWorktree(cardId, card, project);
  }

  private async onMoveToProductionQueue(
    cardId: string,
    card: CardRow,
    project: ProjectRow
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
    const runningCards = repos.cards.findByConditions({ projectId: project.id, column: "production", agentStatus: "running", notId: cardId });

    if (runningCards.length > 0) {
      // Queue this card
      repos.cards.update(cardId, {
          column: "production",
          agentStatus: "queued",
          updatedAt: new Date().toISOString(),
        });

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

    repos.cards.update(cardId, {
        column: "production",
        agentStatus: "running",
        claudeSessionId: sessionId,
        updatedAt: new Date().toISOString(),
      });

    const planningMessages = repos.chatMessages.findByCardIdAndColumn(cardId, "features");

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

IMPORTANT: After implementing the feature, run the project's tests. Then use the report_test_results tool to report which tests passed, failed, or were skipped. This helps track test status on the board.

Card: ${card.title}
${card.description ? `Description: ${card.description}` : ""}${planningContext}${filesContext}`;

    this.log(cardId, "Agent started in queue mode (no worktree).");
    const devMcp = createDevMcpServer(cardId);
    this.spawnAgent(cardId, project.repoPath, handoffMessage, {
      sessionId,
      column: "production",
      mcpServers: { "trellai-dev": devMcp },
    });

    try {
      emitToCard(cardId, "agent:status", { cardId, status: "running" });
    } catch {
      // Socket may not be available
    }
  }

  private async onMoveToProductionWorktree(
    cardId: string,
    card: CardRow,
    project: ProjectRow
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
    const otherCards = repos.cards.findByConditions({ column: "production", notId: cardId });

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
      repos.cards.update(cardId, {
          column: "production",
          branchName,
          worktreePath,
          agentStatus: "running",
          updatedAt: new Date().toISOString(),
        });

      const filesContextForked = this.getFilesContext(card.projectId, cardId);
      const handoffMessage = `You are now in a development worktree at ${worktreePath} on branch ${branchName}. Your planning discussion is preserved in this session — proceed to implement the feature.${conflictWarning}${filesContextForked}

IMPORTANT: After implementing the feature, run the project's tests. Then use the report_test_results tool to report which tests passed, failed, or were skipped.`;

      this.log(cardId, "Session forked to development environment.");
      const devMcpFork = createDevMcpServer(cardId);
      this.spawnAgent(cardId, worktreePath, handoffMessage, {
        resumeSessionId: planningSessionId,
        forkSession: true,
        column: "production",
        mcpServers: { "trellai-dev": devMcpFork },
      });
    } else {
      const sessionId = uuid();

      repos.cards.update(cardId, {
          column: "production",
          branchName,
          worktreePath,
          claudeSessionId: sessionId,
          agentStatus: "running",
          updatedAt: new Date().toISOString(),
        });

      const planningMessages = repos.chatMessages.findByCardIdAndColumn(cardId, "features");

      let planningContext = "";
      if (planningMessages.length > 0) {
        const conversation = planningMessages
          .filter(m => m.role === "user" || m.role === "assistant")
          .map(m => `${m.role}: ${m.content}`)
          .join("\n\n");
        planningContext = `\n\nPlanning discussion:\n${conversation}`;
      }

      const filesContextNew = this.getFilesContext(card.projectId, cardId);
      const handoffMessage = `You are now in a development worktree at ${worktreePath} on branch ${branchName}. Implement the feature based on the planning discussion below.${conflictWarning}${planningContext}${filesContextNew}

IMPORTANT: After implementing the feature, run the project's tests. Then use the report_test_results tool to report which tests passed, failed, or were skipped.`;

      this.log(cardId, "Session transferred to development environment.");
      const devMcpNew = createDevMcpServer(cardId);
      this.spawnAgent(cardId, worktreePath, handoffMessage, {
        sessionId,
        column: "production",
        mcpServers: { "trellai-dev": devMcpNew },
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

    const card = repos.cards.findById(cardId);

    // Queue mode: auto-commit any uncommitted changes
    if (card && !card.worktreePath) {
      const project = repos.projects.findById(card.projectId);
      if (project && queueManager.hasUncommittedChanges(project.repoPath)) {
        try {
          const { sha } = queueManager.commitChanges(project.repoPath, card.title, cardId);
          repos.cards.update(cardId, { commitSha: sha, updatedAt: new Date().toISOString() });
          this.log(cardId, `Auto-committed changes: \`${sha.substring(0, 8)}\``);
        } catch (err) {
          console.error(`[orchestrator] Auto-commit on review failed for ${cardId}:`, err);
        }
      }
      // Process next queued card
      if (project) this.processNextInQueue(project.id);
    }

    repos.cards.update(cardId, {
        agentStatus: "complete",
        updatedAt: new Date().toISOString(),
      });
  }

  async onMoveToComplete(cardId: string) {
    const card = repos.cards.findById(cardId);
    if (!card) return;

    const project = repos.projects.findById(card.projectId);
    if (!project) return;

    // Queue mode — work is already committed on main, just mark done
    if (!card.branchName && card.commitSha) {
      repos.chatMessages.create({
        id: uuid(),
        cardId,
        projectId: null,
        role: "system",
        content: `Approved. Commit \`${card.commitSha.substring(0, 8)}\` is already on main.`,
        column: "complete",
        messageType: null,
        createdAt: new Date().toISOString(),
      });

      repos.cards.update(cardId, {
          agentStatus: "merged",
          updatedAt: new Date().toISOString(),
        });
      return;
    }

    // Worktree mode — merge branch
    if (!card.branchName) return;

    const result = worktreeManager.mergeBranch(
      project.repoPath,
      card.branchName
    );

    if (!result.success) {
      repos.cards.update(cardId, {
          column: "review",
          agentStatus: "error",
          updatedAt: new Date().toISOString(),
        });

      repos.chatMessages.create({
        id: uuid(),
        cardId,
        projectId: null,
        role: "system",
        content: `Merge failed: ${result.error}`,
        column: "review",
        messageType: null,
        createdAt: new Date().toISOString(),
      });

      throw new Error(`Merge failed: ${result.error}`);
    }

    repos.chatMessages.create({
      id: uuid(),
      cardId,
      projectId: null,
      role: "system",
      content: `Branch \`${card.branchName}\` merged successfully.`,
      column: "complete",
      messageType: null,
      createdAt: new Date().toISOString(),
    });

    if (card.worktreePath) {
      worktreeManager.deleteWorktree(
        project.repoPath,
        card.worktreePath,
        card.branchName
      );
    }

    repos.cards.update(cardId, {
        agentStatus: "merged",
        worktreePath: null,
        updatedAt: new Date().toISOString(),
      });
  }

  async onMoveToFeatures(cardId: string) {
    // Stop agent if running
    const proc = this.processes.get(cardId);
    if (proc?.isRunning) {
      proc.stop();
    }
    this.processes.delete(cardId);

    const card = repos.cards.findById(cardId);
    if (!card) return;

    // Remove from queue if queued
    const project = repos.projects.findById(card.projectId);

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

    repos.cards.update(cardId, {
        agentStatus: "idle",
        branchName: null,
        worktreePath: null,
        claudeSessionId: null,
        commitSha: null,
        updatedAt: new Date().toISOString(),
      });

    // Process next queued card if there was one waiting
    if (project) this.processNextInQueue(project.id);
  }

  private processNextInQueue(projectId: string) {
    const q = this.queue.get(projectId) || [];
    if (q.length === 0) {
      // Also check DB for queued cards (in case queue was lost on hot reload)
      const queuedCards = repos.cards.findByConditions({ projectId: projectId, agentStatus: "queued", column: "production" })
        .sort((a, b) => a.position - b.position);

      if (queuedCards.length === 0) return;

      // Rebuild queue from DB
      for (const c of queuedCards) {
        q.push(c.id);
      }
      this.queue.set(projectId, q);
    }

    // Check no other card is currently running in production for this project
    const runningCards = repos.cards.findByConditions({ projectId: projectId, column: "production", agentStatus: "running" });

    if (runningCards.length > 0) return;

    const nextCardId = q.shift()!;
    const nextCard = repos.cards.findById(nextCardId);
    if (!nextCard || nextCard.column !== "production") return;

    const project = repos.projects.findById(projectId);
    if (!project) return;

    // Start the queued card
    const sessionId = uuid();
    repos.cards.update(nextCardId, {
        agentStatus: "running",
        claudeSessionId: sessionId,
        updatedAt: new Date().toISOString(),
      });

    const planningMessages = repos.chatMessages.findByCardIdAndColumn(nextCardId, "features");

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

IMPORTANT: After implementing the feature, run the project's tests. Then use the report_test_results tool to report which tests passed, failed, or were skipped.

Card: ${nextCard.title}
${nextCard.description ? `Description: ${nextCard.description}` : ""}${planningContext}${queueFilesContext}`;

    this.log(nextCardId, "Queue slot available — agent started.");
    const devMcpQueue = createDevMcpServer(nextCardId);
    this.spawnAgent(nextCardId, project.repoPath, handoffMessage, {
      sessionId,
      column: "production",
      mcpServers: { "trellai-dev": devMcpQueue },
    });

    try {
      emitToCard(nextCardId, "agent:status", { cardId: nextCardId, status: "running" });
    } catch {
      // Socket may not be available
    }
  }

  async revertCard(cardId: string) {
    const card = repos.cards.findById(cardId);
    if (!card || !card.commitSha) throw new Error("Card has no commit to revert");

    const project = repos.projects.findById(card.projectId);
    if (!project) throw new Error("Project not found");

    const result = queueManager.revertCommit(project.repoPath, card.commitSha);
    if (!result.success) {
      throw new Error(`Revert failed: ${result.error}`);
    }

    repos.cards.update(cardId, {
        agentStatus: "reverted",
        commitSha: null,
        updatedAt: new Date().toISOString(),
      });

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
    const card = repos.cards.findById(cardId);
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
      cardId: null as string | null,
      projectId: projectId as string | null,
      role: "system",
      content,
      column: "project",
      messageType: null as string | null,
      createdAt: new Date().toISOString(),
    };
    repos.chatMessages.create(msg);
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
    const project = repos.projects.findById(projectId);
    if (!project) throw new Error("Project not found");

    // Save user message
    repos.chatMessages.create({
        id: uuid(),
        cardId: null,
        projectId,
        role: "user",
        content: message,
        column: "project",
        messageType: null,
              createdAt: new Date().toISOString(),
      });

    // Stop existing process if running
    const proc = this.projectProcesses.get(projectId);
    if (proc?.isRunning) {
      proc.stop();
      this.projectProcesses.delete(projectId);
    }

    const hasValidSession = !!project.chatSessionId;

    if (!hasValidSession) {
      const sessionId = uuid();
      repos.projects.update(projectId, { chatSessionId: sessionId });

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

      // Persist verbose output to DB
      if (data.type === "result") {
        if (data.content) {
          repos.chatMessages.create({
              id: uuid(),
              cardId: null,
              projectId,
              role: "assistant",
              content: data.content,
              column: "project",
              messageType: null,
              createdAt: new Date().toISOString(),
            });
        }
      } else if (data.type === "system") {
        repos.chatMessages.create({
            id: uuid(),
            cardId: null,
            projectId,
            role: "system",
            content: data.content,
            column: "project",
            messageType: null,
            createdAt: new Date().toISOString(),
          });
      } else if (data.type === "thinking") {
        repos.chatMessages.create({
            id: uuid(),
            cardId: null,
            projectId,
            role: "assistant",
            content: data.content,
            column: "project",
            messageType: "thinking",
            createdAt: new Date().toISOString(),
          });
      } else if (data.type === "tool_input") {
        repos.chatMessages.create({
            id: uuid(),
            cardId: null,
            projectId,
            role: "assistant",
            content: data.content,
            column: "project",
            messageType: "tool_input",
            createdAt: new Date().toISOString(),
          });
      } else if (data.type === "tool_result") {
        repos.chatMessages.create({
            id: uuid(),
            cardId: null,
            projectId,
            role: "assistant",
            content: data.content,
            column: "project",
            messageType: "tool_result",
            createdAt: new Date().toISOString(),
          });
      }
    });

    proc.on("session", (data: { sessionId: string }) => {
      console.log(`[orchestrator] projectSession(${projectId}): ${data.sessionId}`);
      repos.projects.update(projectId, { chatSessionId: data.sessionId });
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
        repos.projects.update(projectId, { chatSessionId: null });
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
    repos.chatMessages.deleteByProjectId(projectId);

    // Clear session ID
    repos.projects.update(projectId, { chatSessionId: null });
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
