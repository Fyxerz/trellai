"use client";
import { useState, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileJson,
  File,
  ChevronRight,
  ChevronDown,
  Loader2,
} from "lucide-react";

interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
}

interface FileTreeProps {
  projectId: string;
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "py":
    case "rb":
    case "go":
    case "rs":
    case "java":
    case "sh":
    case "css":
    case "scss":
    case "html":
    case "htm":
      return <FileCode className="h-4 w-4 shrink-0 text-blue-400/70" />;
    case "json":
      return <FileJson className="h-4 w-4 shrink-0 text-yellow-400/70" />;
    case "md":
    case "mdx":
    case "txt":
      return <FileText className="h-4 w-4 shrink-0 text-white/50" />;
    default:
      return <File className="h-4 w-4 shrink-0 text-white/40" />;
  }
}

function DirectoryNode({
  entry,
  projectId,
  selectedFile,
  onSelectFile,
  depth,
}: {
  entry: FileEntry;
  projectId: string;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/repo-files?path=${encodeURIComponent(entry.path)}`
      );
      if (res.ok) {
        const data = await res.json();
        setChildren(data.entries || []);
      }
    } finally {
      setLoading(false);
      setExpanded(true);
    }
  }, [expanded, projectId, entry.path]);

  return (
    <div>
      <button
        onClick={toggle}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white/90 transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-white/30" />
        ) : expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/30" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/30" />
        )}
        {expanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-amber-400/70" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-amber-400/70" />
        )}
        <span className="truncate">{entry.name}</span>
      </button>
      {expanded && (
        <div>
          {children.map((child) =>
            child.type === "directory" ? (
              <DirectoryNode
                key={child.path}
                entry={child}
                projectId={projectId}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                depth={depth + 1}
              />
            ) : (
              <FileNode
                key={child.path}
                entry={child}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                depth={depth + 1}
              />
            )
          )}
          {children.length === 0 && (
            <div
              className="py-1 text-xs text-white/20 italic"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              Empty
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileNode({
  entry,
  selectedFile,
  onSelectFile,
  depth,
}: {
  entry: FileEntry;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  depth: number;
}) {
  const isSelected = selectedFile === entry.path;
  return (
    <button
      onClick={() => onSelectFile(entry.path)}
      className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors ${
        isSelected
          ? "bg-violet-500/20 text-white"
          : "text-white/60 hover:bg-white/5 hover:text-white/80"
      }`}
      style={{ paddingLeft: `${depth * 16 + 28}px` }}
    >
      {getFileIcon(entry.name)}
      <span className="truncate">{entry.name}</span>
    </button>
  );
}

export function FileTree({ projectId, selectedFile, onSelectFile }: FileTreeProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadRoot = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/repo-files`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [projectId, loaded]);

  // Load on mount
  useState(() => {
    loadRoot();
  });

  if (loading && !loaded) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="space-y-0.5 py-1">
      {entries.map((entry) =>
        entry.type === "directory" ? (
          <DirectoryNode
            key={entry.path}
            entry={entry}
            projectId={projectId}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            depth={0}
          />
        ) : (
          <FileNode
            key={entry.path}
            entry={entry}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            depth={0}
          />
        )
      )}
      {entries.length === 0 && loaded && (
        <div className="py-8 text-center text-sm text-white/30">
          No files found
        </div>
      )}
    </div>
  );
}
