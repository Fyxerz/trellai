"use client";
import { useState } from "react";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import type { ChatConversation } from "@/types";

interface ChatHistorySidebarProps {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  agentRunning: boolean;
  onSelect: (conversationId: string) => void;
  onNewChat: () => void;
  onDelete: (conversationId: string) => void;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChatHistorySidebar({
  conversations,
  activeConversationId,
  agentRunning,
  onSelect,
  onNewChat,
  onDelete,
}: ChatHistorySidebarProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (confirmDeleteId === conversationId) {
      onDelete(conversationId);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(conversationId);
      // Auto-clear confirm after 3s
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  return (
    <div className="flex h-full w-[200px] flex-col border-r border-white/8 bg-[#0a0a0f]/80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-2.5">
        <span className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
          History
        </span>
        <button
          onClick={onNewChat}
          disabled={agentRunning}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-white/50 hover:bg-white/8 hover:text-white/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="New conversation"
        >
          <Plus className="h-3 w-3" />
          <span>New</span>
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-3">
            <MessageSquare className="h-4 w-4 text-white/15 mb-2" />
            <p className="text-[11px] text-white/25">
              No conversations yet
            </p>
          </div>
        ) : (
          <div className="py-1">
            {conversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              const isConfirmingDelete = confirmDeleteId === conv.id;

              return (
                <button
                  key={conv.id}
                  onClick={() => !agentRunning && onSelect(conv.id)}
                  disabled={agentRunning && !isActive}
                  className={`group relative flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors ${
                    isActive
                      ? "bg-white/8 border-l-2 border-violet-500"
                      : "border-l-2 border-transparent hover:bg-white/5"
                  } ${agentRunning && !isActive ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <span
                    className={`text-[12px] leading-tight line-clamp-2 ${
                      isActive ? "text-white/90 font-medium" : "text-white/60"
                    }`}
                  >
                    {conv.title}
                  </span>
                  <span className="text-[10px] text-white/30">
                    {formatRelativeTime(conv.updatedAt)}
                  </span>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(e, conv.id)}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 transition-all ${
                      isConfirmingDelete
                        ? "bg-red-500/20 text-red-400 opacity-100"
                        : "opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 hover:bg-white/8"
                    }`}
                    title={isConfirmingDelete ? "Click again to confirm" : "Delete conversation"}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
