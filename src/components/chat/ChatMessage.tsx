"use client";
import type { ChatMessage as ChatMessageType } from "@/types";
import { Wrench } from "lucide-react";

type Segment =
  | { type: "text"; content: string }
  | { type: "tools"; tools: { name: string; count: number }[] };

function parseContent(content: string): Segment[] {
  const marker = /{{tools:([^}]+)}}/g;
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match;

  while ((match = marker.exec(content)) !== null) {
    // Text before this marker
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      if (text.trim()) segments.push({ type: "text", content: text });
    }
    // Parse tool counts
    const tools = match[1].split(",").map((part) => {
      const [name, countStr] = part.split("×");
      return { name, count: parseInt(countStr, 10) || 1 };
    });
    segments.push({ type: "tools", tools });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex);
    if (text.trim()) segments.push({ type: "text", content: text });
  }

  return segments;
}

function formatToolSummary(tools: { name: string; count: number }[]): string {
  return tools
    .map(({ name, count }) => (count === 1 ? name : `${name} ×${count}`))
    .join(" · ");
}

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isSuccess = isSystem && message.content.includes("successfully");

  const hasMarkers = message.content.includes("{{tools:");
  const segments = hasMarkers ? parseContent(message.content) : null;

  return (
    <div className={`flex min-w-0 ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] min-w-0 overflow-hidden rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-gradient-to-r from-violet-500/80 to-indigo-500/80 text-white"
            : isSuccess
              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/15"
              : isSystem
                ? "bg-red-500/10 text-red-300 border border-red-500/15"
                : "bg-white/8 text-white/80"
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
              {message.role}
            </span>
          </div>
        )}
        {segments ? (
          <div className="space-y-1">
            {segments.map((seg, i) =>
              seg.type === "text" ? (
                <p key={i} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {seg.content}
                </p>
              ) : (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-white/30"
                >
                  <Wrench className="h-3 w-3" />
                  {formatToolSummary(seg.tools)}
                </span>
              )
            )}
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
        )}
      </div>
    </div>
  );
}
