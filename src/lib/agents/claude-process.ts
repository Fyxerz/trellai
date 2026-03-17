import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Options, McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import { EventEmitter } from "events";

export interface SpawnOptions {
  sessionId?: string;
  resumeSessionId?: string;
  /** Fork a resumed session instead of continuing it in-place */
  forkSession?: boolean;
  systemPrompt?: string;
  /** Restrict available tools (e.g. ['Read', 'Grep', 'Glob', 'Bash']) */
  tools?: string[];
  /** Explicitly disallowed tools (belt-and-suspenders with tools) */
  disallowedTools?: string[];
  /** In-process MCP servers to expose to the agent */
  mcpServers?: Record<string, McpSdkServerConfigWithInstance>;
}

interface ActiveBlock {
  type: string;
  toolName?: string;
  inputChunks?: string[];
}

function formatToolInput(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Read":
      return `Read: ${input.file_path || ""}`;
    case "Write":
      return `Write: ${input.file_path || ""}`;
    case "Edit":
      return `Edit: ${input.file_path || ""}`;
    case "Bash": {
      const cmd = String(input.command || "");
      return `Bash: ${cmd.length > 120 ? cmd.slice(0, 120) + "…" : cmd}`;
    }
    case "Grep": {
      const pattern = input.pattern || "";
      const path = input.path || ".";
      return `Grep: "${pattern}" in ${path}`;
    }
    case "Glob":
      return `Glob: ${input.pattern || ""}`;
    case "Agent":
      return `Agent: ${input.description || ""}`;
    default: {
      const json = JSON.stringify(input);
      return `${toolName}: ${json.length > 120 ? json.slice(0, 120) + "…" : json}`;
    }
  }
}

export class ClaudeProcess extends EventEmitter {
  private activeQuery: ReturnType<typeof query> | null = null;
  private _isRunning = false;
  private abortController: AbortController | null = null;
  private activeBlocks = new Map<number, ActiveBlock>();
  private lastToolName: string | null = null;

  get isRunning() {
    return this._isRunning;
  }

  spawn(workDir: string, prompt: string | null, options: SpawnOptions = {}): void {
    if (this._isRunning) {
      throw new Error("Process already running");
    }

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    this.abortController = new AbortController();
    this._isRunning = true;
    this.activeBlocks.clear();
    this.lastToolName = null;

    const queryOptions: Options = {
      model: "claude-opus-4-6",
      cwd: workDir,
      abortController: this.abortController,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      includePartialMessages: true,
    };

    if (options.sessionId) {
      queryOptions.sessionId = options.sessionId;
    }
    if (options.resumeSessionId) {
      queryOptions.resume = options.resumeSessionId;
    }
    if (options.forkSession) {
      queryOptions.forkSession = true;
    }
    if (options.systemPrompt) {
      queryOptions.systemPrompt = options.systemPrompt;
    }
    if (options.tools) {
      queryOptions.tools = options.tools;
    }
    if (options.disallowedTools) {
      queryOptions.disallowedTools = options.disallowedTools;
    }
    if (options.mcpServers) {
      queryOptions.mcpServers = options.mcpServers;
    }

    console.log(`[claude-process] Starting SDK query: cwd=${workDir}, session=${options.sessionId || "none"}, resume=${options.resumeSessionId || "none"}`);

    this.activeQuery = query({ prompt, options: queryOptions });

    this.emit("ready");

    this.consumeMessages();
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.activeQuery) {
      this.activeQuery.close();
    }
    this._isRunning = false;
  }

  // Not used with the SDK — each message is a new query() with resume
  sendMessage(_message: string): void {
    throw new Error("sendMessage is not supported — use spawn() with resumeSessionId instead");
  }

  private async consumeMessages(): Promise<void> {
    try {
      for await (const msg of this.activeQuery!) {
        this.handleMessage(msg);
      }
      console.log(`[claude-process] Query completed`);
      this._isRunning = false;
      this.emit("exit", 0);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[claude-process] Query error: ${errMsg}`);
      this._isRunning = false;
      this.emit("error", errMsg);
      this.emit("exit", 1);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleMessage(msg: any): void {
    switch (msg.type) {
      case "assistant": {
        // Full assistant message (end of turn) — extract tool results from content blocks
        if (msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === "tool_use" && block.name) {
              // Already emitted via stream_event, but emit again as a safety net
              // (only if we haven't seen this block via streaming)
            }
            if (block.type === "tool_result") {
              const resultContent = typeof block.content === "string"
                ? block.content
                : Array.isArray(block.content)
                  ? block.content.map((b: { text?: string }) => b.text || "").join("\n")
                  : JSON.stringify(block.content);
              const truncated = resultContent.length > 500
                ? resultContent.slice(0, 500) + "…"
                : resultContent;
              this.emit("output", {
                type: "tool_result",
                content: truncated,
                toolName: this.lastToolName || "unknown",
              });
            }
          }
        }
        break;
      }

      case "user": {
        // User messages can contain tool_result blocks
        if (msg.message?.content) {
          const content = Array.isArray(msg.message.content) ? msg.message.content : [msg.message.content];
          for (const block of content) {
            if (block.type === "tool_result") {
              const resultText = typeof block.content === "string"
                ? block.content
                : Array.isArray(block.content)
                  ? block.content.map((b: { text?: string }) => b.text || "").join("\n")
                  : JSON.stringify(block.content || "");
              const truncated = resultText.length > 500
                ? resultText.slice(0, 500) + "…"
                : resultText;
              this.emit("output", {
                type: "tool_result",
                content: truncated,
                toolName: this.lastToolName || "unknown",
              });
            }
          }
        }
        break;
      }

      case "stream_event": {
        const event = msg.event;
        if (!event) break;

        // Thinking block start
        if (event.type === "content_block_start" && event.content_block?.type === "thinking") {
          const idx = event.index ?? 0;
          this.activeBlocks.set(idx, { type: "thinking" });
          // Don't emit start marker — we'll stream deltas
        }

        // Thinking delta
        if (event.type === "content_block_delta" && event.delta?.type === "thinking_delta" && event.delta.thinking) {
          this.emit("output", { type: "thinking", content: event.delta.thinking });
        }

        // Text delta
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
          this.emit("output", { type: "text", content: event.delta.text });
        }

        // Tool use block start
        if (event.type === "content_block_start" && event.content_block?.type === "tool_use" && event.content_block.name) {
          const idx = event.index ?? 0;
          const toolName = event.content_block.name;
          this.activeBlocks.set(idx, { type: "tool_use", toolName, inputChunks: [] });
          this.lastToolName = toolName;
          this.emit("output", { type: "tool_use", content: `Using tool: ${toolName}`, toolName });
        }

        // Tool input JSON delta
        if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta" && event.delta.partial_json) {
          // Find the active tool_use block
          for (const [, block] of this.activeBlocks) {
            if (block.type === "tool_use" && block.inputChunks) {
              block.inputChunks.push(event.delta.partial_json);
            }
          }
        }

        // Content block stop — finalize tool input
        if (event.type === "content_block_stop") {
          const idx = event.index ?? 0;
          const block = this.activeBlocks.get(idx);
          if (block?.type === "tool_use" && block.inputChunks && block.toolName) {
            try {
              const inputJson = JSON.parse(block.inputChunks.join(""));
              const formatted = formatToolInput(block.toolName, inputJson);
              this.emit("output", {
                type: "tool_input",
                content: formatted,
                toolName: block.toolName,
                toolInput: inputJson,
              });
            } catch {
              // JSON parse failed — emit what we have
              this.emit("output", {
                type: "tool_input",
                content: `${block.toolName}: (input unavailable)`,
                toolName: block.toolName,
              });
            }
          }
          this.activeBlocks.delete(idx);
        }

        break;
      }

      case "tool_use_summary": {
        // Human-readable summary from the SDK
        if (msg.summary) {
          this.emit("output", { type: "tool_summary", content: msg.summary });
        }
        break;
      }

      case "tool_progress": {
        if (msg.tool_name) {
          this.emit("output", {
            type: "tool_progress",
            content: msg.tool_name,
            toolName: msg.tool_name,
          });
        }
        break;
      }

      case "result": {
        const content = msg.subtype === "success" ? (msg.result || "") : "";
        this.emit("output", { type: "result", content });
        // Emit session_id so orchestrator can capture it
        if (msg.session_id) {
          this.emit("session", { sessionId: msg.session_id });
        }
        // Emit cost/usage data from result messages
        if (msg.total_cost_usd !== undefined || msg.model_usage) {
          this.emit("usage", {
            type: "cost",
            totalCostUsd: msg.total_cost_usd,
            modelUsage: msg.model_usage,
          });
        }
        break;
      }

      case "rate_limit_event": {
        // SDK rate limit info — forward for usage tracking
        if (msg.rate_limit_info) {
          this.emit("usage", {
            type: "rate_limit",
            rateLimitInfo: msg.rate_limit_info,
          });
        }
        break;
      }

      case "system": {
        // Init message — capture session_id
        if (msg.session_id) {
          this.emit("session", { sessionId: msg.session_id });
        }
        break;
      }

      default:
        break;
    }
  }
}
