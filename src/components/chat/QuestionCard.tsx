"use client";
import { useState } from "react";
import { HelpCircle, ChevronRight, Pencil } from "lucide-react";
import type { PendingQuestion } from "@/hooks/useChat";

interface QuestionCardProps {
  question: PendingQuestion;
  onAnswer: (questionId: string, answer: string, questionText: string) => void;
}

export function QuestionCard({ question, onAnswer }: QuestionCardProps) {
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");

  const handleOptionClick = (option: string) => {
    onAnswer(question.questionId, option, question.question);
  };

  const handleCustomSubmit = () => {
    if (!customText.trim()) return;
    onAnswer(question.questionId, customText.trim(), question.question);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCustomSubmit();
    }
  };

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className="rounded-lg bg-violet-500/15 p-1.5 mt-0.5">
          <HelpCircle className="h-4 w-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/60 mb-1">
            Claude is asking
          </p>
          <p className="text-sm text-white/90 leading-relaxed">
            {question.question}
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-1.5 pl-9">
        {question.options.map((option, i) => (
          <button
            key={i}
            onClick={() => handleOptionClick(option)}
            className="w-full flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-white/80 hover:bg-white/8 hover:border-violet-500/30 hover:text-white transition-all group text-left"
          >
            <span className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-md bg-white/8 text-[11px] font-medium text-white/40 group-hover:bg-violet-500/20 group-hover:text-violet-300 transition-colors">
              {i + 1}
            </span>
            <span className="flex-1 min-w-0">{option}</span>
            <ChevronRight className="h-3.5 w-3.5 text-white/15 group-hover:text-violet-400 transition-colors flex-shrink-0" />
          </button>
        ))}

        {/* "Something else..." option */}
        {!customMode ? (
          <button
            onClick={() => setCustomMode(true)}
            className="w-full flex items-center gap-2.5 rounded-lg border border-dashed border-white/8 bg-transparent px-3 py-2.5 text-sm text-white/40 hover:bg-white/4 hover:border-white/15 hover:text-white/60 transition-all group text-left"
          >
            <span className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-md bg-white/5 text-[11px] font-medium text-white/25 group-hover:bg-white/8 group-hover:text-white/40 transition-colors">
              <Pencil className="h-3 w-3" />
            </span>
            <span className="flex-1">Something else...</span>
          </button>
        ) : (
          <div className="flex items-end gap-2 mt-1">
            <textarea
              autoFocus
              className="flex-1 resize-none rounded-lg bg-white/6 px-3 py-2 text-sm text-white placeholder:text-white/25 border border-violet-500/30 focus:border-violet-500/50 focus:outline-none transition-colors"
              placeholder="Type your answer..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customText.trim()}
              className="rounded-lg bg-violet-500/20 px-3 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/30 transition-colors disabled:opacity-30"
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
