"use client";
import { HelpCircle, Check } from "lucide-react";

interface AnsweredQuestionCardProps {
  question: string;
  answer: string;
}

export function isQAMessage(content: string): boolean {
  return content.startsWith("{{qa:") && content.includes("||") && content.endsWith("}}");
}

export function parseQA(content: string): { question: string; answer: string } {
  const inner = content.slice(5, -2); // strip {{qa: and }}
  const separatorIndex = inner.indexOf("||");
  if (separatorIndex === -1) return { question: inner, answer: "" };
  return {
    question: inner.slice(0, separatorIndex),
    answer: inner.slice(separatorIndex + 2),
  };
}

export function AnsweredQuestionCard({ question, answer }: AnsweredQuestionCardProps) {
  return (
    <div className="rounded-xl border border-violet-500/10 bg-violet-500/[0.03] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className="rounded-lg bg-violet-500/10 p-1.5 mt-0.5">
          <HelpCircle className="h-4 w-4 text-violet-400/60" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/40 mb-1">
            Claude asked
          </p>
          <p className="text-sm text-white/70 leading-relaxed">
            {question}
          </p>
        </div>
      </div>

      {/* Selected answer */}
      <div className="pl-9">
        <div className="flex items-center gap-2.5 rounded-lg border border-violet-500/20 bg-violet-500/8 px-3 py-2.5 text-sm text-white/90">
          <span className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-md bg-violet-500/20">
            <Check className="h-3 w-3 text-violet-300" />
          </span>
          <span className="flex-1 min-w-0">{answer}</span>
        </div>
      </div>
    </div>
  );
}
