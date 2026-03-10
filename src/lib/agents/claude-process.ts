import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Options } from "@anthropic-ai/claude-agent-sdk";
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
}

export class ClaudeProcess extends EventEmitter {
  private activeQuery: ReturnType<typeof query> | null = null;
  private _isRunning = false;
  private abortController: AbortController | null = null;

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
        // Full assistant message (end of turn) — tool_use blocks for display
        if (msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === "tool_use" && block.name) {
              this.emit("output", { type: "tool_use", content: `Using tool: ${block.name}` });
            }
          }
        }
        break;
      }

      case "stream_event": {
        // Streaming partial — extract text deltas from BetaRawMessageStreamEvent
        const event = msg.event;
        if (event?.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
          this.emit("output", { type: "text", content: event.delta.text });
        }
        if (event?.type === "content_block_start" && event.content_block?.type === "tool_use" && event.content_block.name) {
          this.emit("output", { type: "tool_use", content: `Using tool: ${event.content_block.name}` });
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
