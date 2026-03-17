"use client";
import { useState } from "react";
import type { ChatMessage as ChatMessageType, ChatSegment } from "@/types";
import { Brain, Wrench, FileText, ChevronRight } from "lucide-react";

// ── Legacy marker parsing (for old DB messages without messageType) ──

type LegacySegment =
  | { type: "text"; content: string }
  | { type: "tools"; tools: { name: string; count: number }[] };

function parseLegacyContent(content: string): LegacySegment[] {
  const marker = /{{tools:([^}]+)}}/g;
  const segments: LegacySegment[] = [];
  let lastIndex = 0;
  let match;

  while ((match = marker.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      if (text.trim()) segments.push({ type: "text", content: text });
    }
    const tools = match[1].split(",").map((part) => {
      const [name, countStr] = part.split("×");
      return { name, count: parseInt(countStr, 10) || 1 };
    });
    segments.push({ type: "tools", tools });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex);
    if (text.trim()) segments.push({ type: "text", content: text });
  }

  return segments;
}

// ── Parse historical messages from DB using messageType field ──

function parsePersistedMessage(message: ChatMessageType): ChatSegment[] | null {
  const mt = message.messageType;
  if (!mt) return null; // Regular message — no special parsing

  switch (mt) {
    case "thinking":
      return [{ kind: "thinking", content: message.content }];
    case "tool_input": {
      // Format: "ToolName: details"
      const colonIdx = message.content.indexOf(": ");
      const toolName = colonIdx > 0 ? message.content.slice(0, colonIdx) : "Tool";
      return [{ kind: "tool_use", toolName, input: message.content }];
    }
    case "tool_result": {
      return [{ kind: "tool_result", toolName: "Tool", content: message.content }];
    }
    case "tool_summary":
      return [{ kind: "text", content: message.content }];
    default:
      return null;
  }
}

// ── Segment renderers ──

function ThinkingBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const preview = content.length > 100 ? content.slice(0, 100) + "…" : content;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="group rounded-md bg-violet-500/5 border border-violet-500/10"
    >
      <summary className="flex items-center gap-1.5 px-2 py-1 cursor-pointer select-none text-[11px] text-white/30 hover:text-white/50 transition-colors">
        <ChevronRight className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
        <Brain className="h-3 w-3 text-violet-400/60" />
        <span className="font-medium text-violet-400/60">Thinking</span>
        {!open && (
          <span className="ml-1 truncate italic text-white/20">{preview}</span>
        )}
      </summary>
      <div className="px-3 py-2 text-[11px] text-white/30 italic whitespace-pre-wrap break-words leading-relaxed border-t border-violet-500/10">
        {content}
      </div>
    </details>
  );
}

function ToolUseBlock({ toolName, input }: { toolName: string; input: string }) {
  return (
    <div className="flex items-start gap-1.5 rounded-md bg-white/3 px-2 py-1 text-[11px]">
      <Wrench className="h-3 w-3 mt-0.5 text-amber-400/60 shrink-0" />
      <span className="font-semibold text-amber-400/60">{toolName}</span>
      {input && input !== `Using tool: ${toolName}` && (
        <span className="text-white/25 font-mono truncate">{input.replace(`${toolName}: `, "")}</span>
      )}
    </div>
  );
}

function ToolResultBlock({ toolName, content }: { toolName: string; content: string }) {
  const [open, setOpen] = useState(false);
  const preview = content.length > 80 ? content.slice(0, 80) + "…" : content;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="group rounded-md bg-white/3 border border-white/5"
    >
      <summary className="flex items-center gap-1.5 px-2 py-1 cursor-pointer select-none text-[11px] text-white/25 hover:text-white/40 transition-colors">
        <ChevronRight className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
        <FileText className="h-3 w-3 text-emerald-400/50" />
        <span className="font-medium text-emerald-400/50">Result</span>
        {toolName !== "unknown" && toolName !== "Tool" && (
          <span className="text-white/15">({toolName})</span>
        )}
        {!open && (
          <span className="ml-1 truncate font-mono text-white/15">{preview}</span>
        )}
      </summary>
      <div className="px-3 py-2 text-[11px] text-white/20 font-mono whitespace-pre-wrap break-words leading-relaxed max-h-48 overflow-y-auto border-t border-white/5">
        {content}
      </div>
    </details>
  );
}

function LegacyToolBadge({ tools }: { tools: { name: string; count: number }[] }) {
  const summary = tools
    .map(({ name, count }) => (count === 1 ? name : `${name} ×${count}`))
    .join(" · ");
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-white/30">
      <Wrench className="h-3 w-3" />
      {summary}
    </span>
  );
}

// ── Main component ──

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  animate?: boolean;
}

export function ChatMessage({ message, isStreaming = false, animate = true }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  const lowerContent = isSystem ? message.content.toLowerCase() : "";
  const isSuccess = isSystem && lowerContent.includes("successfully");
  const isError = isSystem && !isSuccess && (lowerContent.startsWith("error") || lowerContent.includes("failed"));
  const isWarning = isSystem && !isSuccess && !isError && lowerContent.includes("warning");

  // Determine segments to render
  let segments: ChatSegment[] | null = message.segments || null;

  // For persisted messages with messageType, parse into segments
  if (!segments && message.messageType) {
    segments = parsePersistedMessage(message);
  }

  // Legacy: parse {{tools:...}} markers
  const hasLegacyMarkers = !segments && message.content.includes("{{tools:");
  const legacySegments = hasLegacyMarkers ? parseLegacyContent(message.content) : null;

  const systemStyle = isSuccess
    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/15"
    : isError
      ? "bg-red-500/10 text-red-300 border border-red-500/15"
      : isWarning
        ? "bg-yellow-500/10 text-yellow-300 border border-yellow-500/15"
        : "bg-white/10 text-white/70 border border-white/15";

  // Blinking cursor for streaming messages
  const cursor = isStreaming ? (
    <span className="inline-block w-[2px] h-[1.1em] bg-violet-400 ml-0.5 align-middle animate-blink" />
  ) : null;

  // QA block check (used in planning)
  const isQA = message.content.startsWith("{{qa:");

  return (
    <div className={`flex min-w-0 ${isUser ? "justify-end" : "justify-start"} ${animate ? "animate-message-in" : ""}`}>
      <div
        className={`min-w-0 overflow-hidden rounded-xl px-4 py-2.5 text-sm leading-relaxed transition-[width] duration-300 ease-out ${
          isStreaming ? "w-[85%]" : "max-w-[85%]"
        } ${
          isUser
            ? "bg-gradient-to-r from-violet-500/80 to-indigo-500/80 text-white"
            : isSystem
              ? systemStyle
              : "bg-white/8 text-white/80"
        } ${isStreaming ? "border border-violet-500/20" : ""}`}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
              {message.role}
            </span>
          </div>
        )}

        {/* Rich segments (streaming or persisted with messageType) */}
        {segments && segments.length > 0 ? (
          <div className="space-y-1.5">
            {segments.map((seg, i) => {
              switch (seg.kind) {
                case "thinking":
                  return <ThinkingBlock key={i} content={seg.content} />;
                case "tool_use":
                  return <ToolUseBlock key={i} toolName={seg.toolName} input={seg.input} />;
                case "tool_result":
                  return <ToolResultBlock key={i} toolName={seg.toolName} content={seg.content} />;
                case "tools_compact":
                  return <LegacyToolBadge key={i} tools={seg.tools} />;
                case "text":
                  return (
                    <p key={i} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {seg.content}
                      {i === segments!.length - 1 && cursor}
                    </p>
                  );
                default:
                  return null;
              }
            })}
            {/* If the last segment isn't text, still show cursor */}
            {cursor && segments.length > 0 && segments[segments.length - 1].kind !== "text" && (
              <div>{cursor}</div>
            )}
          </div>
        ) : legacySegments ? (
          /* Legacy {{tools:...}} marker rendering */
          <div className="space-y-1">
            {legacySegments.map((seg, i) =>
              seg.type === "text" ? (
                <p key={i} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {seg.content}
                  {i === legacySegments.length - 1 && cursor}
                </p>
              ) : (
                <LegacyToolBadge key={i} tools={seg.tools} />
              )
            )}
          </div>
        ) : isQA ? null : (
          /* Plain text rendering */
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {message.content}
            {cursor}
          </p>
        )}
      </div>
    </div>
  );
}
