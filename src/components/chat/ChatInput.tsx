"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  placeholder: string;
  onSend: (content: string) => void;
  disabled?: boolean;
  agentRunning?: boolean;
  onStop?: () => void;
}

export function ChatInput({ placeholder, onSend, disabled, agentRunning, onStop }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={textareaRef}
        className="flex-1 resize-none rounded-xl bg-white/6 px-4 py-2.5 text-sm text-white placeholder:text-white/25 border border-white/10 focus:border-white/20 focus:outline-none transition-colors"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
      />
      {agentRunning && onStop ? (
        <button
          onClick={onStop}
          className="rounded-xl bg-red-500/15 px-3 py-2 text-red-400 hover:bg-red-500/25 transition-all"
          title="Stop agent"
        >
          <Square className="h-4 w-4 fill-current" />
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-2 text-white shadow-lg shadow-violet-500/15 hover:shadow-violet-500/30 transition-all disabled:opacity-30 disabled:shadow-none"
        >
          <Send className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
