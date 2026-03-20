"use client";
import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Trash2, Square, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { useProjectChat } from "@/hooks/useProjectChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatHistorySidebar } from "./ChatHistorySidebar";

interface ProjectChatWidgetProps {
  projectId: string;
  projectName: string;
  onCardCreated: () => void;
}

export function ProjectChatWidget({
  projectId,
  projectName,
  onCardCreated,
}: ProjectChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const {
    messages,
    conversations,
    activeConversationId,
    agentRunning,
    streaming,
    sendMessage,
    selectConversation,
    startNewConversation,
    deleteConversation,
    clearChat,
  } = useProjectChat(projectId, onCardCreated);
  const bottomRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Click outside to minimize
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const panelWidth = showHistory ? "w-[600px]" : "w-[400px]";

  return (
    <>
      {/* Floating chat panel */}
      {isOpen && (
        <div ref={panelRef} className={`fixed bottom-20 right-6 z-50 flex h-[520px] ${panelWidth} rounded-2xl border border-white/10 bg-[#0d0d12]/95 backdrop-blur-xl shadow-2xl shadow-black/50 transition-all duration-200`}>
          {/* History sidebar */}
          {showHistory && (
            <ChatHistorySidebar
              conversations={conversations}
              activeConversationId={activeConversationId}
              agentRunning={agentRunning}
              onSelect={(id) => {
                selectConversation(id);
              }}
              onNewChat={() => {
                startNewConversation();
              }}
              onDelete={(id) => {
                deleteConversation(id);
              }}
            />
          )}

          {/* Main chat area */}
          <div className="flex flex-1 flex-col min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 transition-colors"
                  title={showHistory ? "Hide history" : "Show history"}
                >
                  {showHistory ? (
                    <PanelLeftClose className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <PanelLeftOpen className="h-3.5 w-3.5 text-white" />
                  )}
                </button>
                <div>
                  <h3 className="text-sm font-semibold text-white/90">
                    Project Chat
                  </h3>
                  <p className="text-[10px] text-white/40 truncate max-w-[200px]">
                    {activeConversationId
                      ? conversations.find((c) => c.id === activeConversationId)?.title ?? projectName
                      : projectName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {agentRunning && (
                  <button
                    onClick={() =>
                      fetch("/api/project-chat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "stop",
                          projectId,
                        }),
                      })
                    }
                    className="rounded-lg p-1.5 text-white/40 hover:bg-white/8 hover:text-orange-400 transition-colors"
                    title="Stop agent"
                  >
                    <Square className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={clearChat}
                  className="rounded-lg p-1.5 text-white/40 hover:bg-white/8 hover:text-red-400 transition-colors"
                  title="Clear all chats"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-white/40 hover:bg-white/8 hover:text-white transition-colors"
                  title="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="space-y-3 p-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-full bg-white/5 p-3 mb-3">
                      <MessageCircle className="h-5 w-5 text-white/20" />
                    </div>
                    <p className="text-sm text-white/30 max-w-[240px]">
                      {activeConversationId
                        ? "This conversation is empty."
                        : "Start a new conversation about your project."}
                    </p>
                  </div>
                )}
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {streaming && (
                  <div className="flex items-center gap-1.5 px-2 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse [animation-delay:300ms]" />
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-white/8 p-4">
              <ChatInput
                placeholder="Ask about the project..."
                onSend={sendMessage}
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all ${
          isOpen
            ? "bg-white/10 text-white/60 hover:bg-white/15 shadow-black/20"
            : "bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-105"
        }`}
        title="Project Chat"
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
      </button>
    </>
  );
}
