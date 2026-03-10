"use client";
import type { ChatMessage as ChatMessageType } from "@/types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isSuccess = isSystem && message.content.includes("successfully");

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
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
      </div>
    </div>
  );
}
