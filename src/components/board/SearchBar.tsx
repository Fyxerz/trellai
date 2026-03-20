"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (query: string) => void;
  matchCount?: number;
  totalCards?: number;
}

export function SearchBar({ value, onChange, matchCount, totalCards }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes (e.g. clear from parent)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const debouncedOnChange = useCallback(
    (val: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange(val);
      }, 200);
    },
    [onChange],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    debouncedOnChange(val);
  };

  const handleClear = () => {
    setLocalValue("");
    onChange("");
    inputRef.current?.focus();
  };

  // Keyboard shortcut: Cmd/Ctrl+K to focus, Escape to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        handleClear();
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActive = value.length > 0;

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-2.5 h-3.5 w-3.5 text-white/30 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder="Search cards... (⌘K)"
        className={`h-8 w-56 rounded-lg border bg-white/5 pl-8 pr-8 text-sm text-white/90 placeholder:text-white/30 outline-none transition-all ${
          isActive
            ? "border-violet-400/50 ring-1 ring-violet-400/20 w-72"
            : "border-white/10 hover:border-white/20 focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/20 focus:w-72"
        }`}
      />
      {isActive && (
        <div className="absolute right-2 flex items-center gap-1.5">
          <span className="text-[11px] text-white/40">
            {matchCount}/{totalCards}
          </span>
          <button
            onClick={handleClear}
            className="rounded p-0.5 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
