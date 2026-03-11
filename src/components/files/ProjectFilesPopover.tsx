"use client";
import { useState, useRef, useEffect } from "react";
import {
  FolderOpen,
  Paperclip,
  Loader2,
  Trash2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  FileCode,
  File,
} from "lucide-react";
import type { FileAttachment } from "@/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.includes("pdf") || mimeType.includes("text/")) return FileText;
  if (
    mimeType.includes("json") ||
    mimeType.includes("javascript") ||
    mimeType.includes("typescript")
  )
    return FileCode;
  return File;
}

interface ProjectFilesPopoverProps {
  files: FileAttachment[];
  onUpload: (files: FileList) => Promise<void>;
  onDelete: (fileId: string) => Promise<void>;
  uploading: boolean;
}

export function ProjectFilesPopover({
  files,
  onUpload,
  onDelete,
  uploading,
}: ProjectFilesPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
          open
            ? "bg-white/10 text-white/90"
            : "text-white/40 hover:text-white/60 hover:bg-white/5"
        }`}
        title="Project files"
      >
        <FolderOpen className="h-3.5 w-3.5" />
        <span>Files</span>
        {files.length > 0 && (
          <span className="rounded-full bg-violet-500/20 text-violet-300 px-1.5 py-0 text-[10px] font-semibold">
            {files.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl glass border border-white/10 shadow-2xl shadow-black/50 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
              Project Files
            </span>
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    await onUpload(e.target.files);
                    if (inputRef.current) inputRef.current.value = "";
                  }
                }}
              />
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Paperclip className="h-3 w-3" />
                )}
                Upload
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {files.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-white/20 italic">
                No project files yet. Upload files that all agents can reference.
              </p>
            ) : (
              <div className="py-1">
                {files.map((file) => {
                  const Icon = getFileIcon(file.mimeType);
                  return (
                    <div
                      key={file.id}
                      className="group flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5 text-white/30 shrink-0" />
                      <a
                        href={`/api/files/${file.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 min-w-0 text-xs text-white/70 hover:text-white/90 truncate transition-colors"
                      >
                        {file.filename}
                      </a>
                      <span className="text-[10px] text-white/25 shrink-0">
                        {formatSize(file.size)}
                      </span>
                      <button
                        onClick={() => onDelete(file.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3 text-red-400/50 hover:text-red-400" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
