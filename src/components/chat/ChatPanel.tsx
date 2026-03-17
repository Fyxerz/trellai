"use client";
import { useRef, useEffect, useCallback } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { QuestionCard } from "./QuestionCard";
import { AnsweredQuestionCard, isQAMessage, parseQA } from "./AnsweredQuestionCard";
import { MessageSquare, Sparkles, Rocket } from "lucide-react";
import type { Column } from "@/types";

interface ChatPanelProps {
  cardId: string;
  column: Column;
  cardTitle?: string;
  cardDescription?: string;
  onAutoMove?: () => void;
}

export function ChatPanel({ cardId, column, cardTitle, cardDescription, onAutoMove }: ChatPanelProps) {
  const { messages, agentRunning, streaming, pendingQuestion, sendMessage, confirmMoveToDev, stopAgent, answerQuestion } = useChat(cardId, onAutoMove);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);
  const scrollRAF = useRef<number | null>(null);

  // Smart scroll: only auto-scroll if user is near the bottom, throttled
  const smartScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isNearBottom = distanceFromBottom < 150;

    if (!isNearBottom) return;

    const now = Date.now();
    if (now - lastScrollTime.current < 200) {
      // Throttle: schedule a scroll at the end of the throttle window
      if (scrollRAF.current) cancelAnimationFrame(scrollRAF.current);
      scrollRAF.current = requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
        lastScrollTime.current = Date.now();
      });
      return;
    }

    lastScrollTime.current = now;
    container.scrollTop = container.scrollHeight;
  }, []);

  useEffect(() => {
    smartScroll();
  }, [messages, smartScroll]);

  // Always scroll to bottom on first render / when messages load from DB
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [cardId]);

  const streamingId = `streaming-${cardId}`;

  const canSend =
    column === "features" ||
    column === "planning" ||
    column === "production" ||
    column === "review" ||
    column === "complete";

  const placeholders: Record<Column, string> = {
    features: "Chat with Claude to plan this feature...",
    planning: "Refine and organize this card...",
    production: agentRunning
      ? "Send instructions to the agent..."
      : "Send a message to resume the session...",
    review: "Discuss the changes...",
    complete: "Add a note...",
  };

  const handlePlan = () => {
    const parts = [`Plan the implementation for this card: "${cardTitle || "Untitled"}".`];
    if (cardDescription?.trim()) {
      parts.push(`\n\nDescription:\n${cardDescription.trim()}`);
    }
    sendMessage(parts.join(""), column);
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
        <div className="space-y-3 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-white/5 p-3 mb-3">
                <MessageSquare className="h-5 w-5 text-white/20" />
              </div>
              <p className="text-sm text-white/30 max-w-[240px]">
                {column === "features"
                  ? "Chat with Claude to plan this feature, then move it to development when ready."
                  : column === "production"
                    ? "Agent output will stream here when running."
                    : "No messages yet."}
              </p>
              {column === "features" && (
                <button
                  onClick={handlePlan}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  Plan
                </button>
              )}
            </div>
          )}
          {messages.map((msg) => {
            if (isQAMessage(msg.content)) {
              const { question, answer } = parseQA(msg.content);
              return <AnsweredQuestionCard key={msg.id} question={question} answer={answer} />;
            }
            return <ChatMessage key={msg.id} message={msg} isStreaming={msg.id === streamingId && streaming} />;
          })}
          {pendingQuestion && (
            <QuestionCard
              question={pendingQuestion}
              onAnswer={answerQuestion}
            />
          )}
          {streaming && !pendingQuestion && (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse [animation-delay:300ms]" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Move to Development button for features column */}
      {column === "features" && messages.length > 0 && !agentRunning && (
        <div className="shrink-0 border-t border-white/8 px-4 py-2">
          <button
            onClick={async () => {
              await confirmMoveToDev();
              onAutoMove?.();
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/25 transition-colors"
          >
            <Rocket className="h-4 w-4" />
            Move to Development
          </button>
        </div>
      )}

      <div className="shrink-0 border-t border-white/8 p-4">
        <ChatInput
          placeholder={placeholders[column]}
          onSend={(content) => sendMessage(content, column)}
          disabled={!canSend}
          agentRunning={agentRunning}
          onStop={stopAgent}
        />
      </div>
    </div>
  );
}
