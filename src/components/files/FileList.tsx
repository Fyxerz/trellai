"use client";
import { useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  FileCode,
  File,
  Trash2,
  ExternalLink,
  X,
  FolderOpen,
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

interface FileListProps {
  files: FileAttachment[];
  label?: string;
  onDelete?: (fileId: string) => void;
  dimmed?: boolean;
}

function FileListSection({ files, label, onDelete, dimmed }: FileListProps) {
  const [preview, setPreview] = useState<FileAttachment | null>(null);

  if (files.length === 0) return null;

  return (
    <div className={dimmed ? "opacity-60" : ""}>
      {label && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <FolderOpen className="h-3 w-3 text-white/30" />
          <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">
            {label}
          </span>
        </div>
      )}
      <div className="space-y-1">
        {files.map((file) => {
          const Icon = getFileIcon(file.mimeType);
          return (
            <div
              key={file.id}
              className="group flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-white/5 transition-colors"
            >
              <Icon className="h-3.5 w-3.5 text-white/30 shrink-0" />
              <button
                onClick={() => {
                  if (file.mimeType.startsWith("image/")) {
                    setPreview(file);
                  } else {
                    window.open(`/api/files/${file.id}`, "_blank");
                  }
                }}
                className="flex-1 min-w-0 text-left"
              >
                <span className="text-xs text-white/70 truncate block hover:text-white/90 transition-colors">
                  {file.filename}
                </span>
              </button>
              <span className="text-[10px] text-white/25 shrink-0">
                {formatSize(file.size)}
              </span>
              <a
                href={`/api/files/${file.id}`}
                target="_blank"
                rel="noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                title="Open in new tab"
              >
                <ExternalLink className="h-3 w-3 text-white/30 hover:text-white/60" />
              </a>
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(file.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete file"
                >
                  <Trash2 className="h-3 w-3 text-red-400/50 hover:text-red-400" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Image preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-w-4xl max-h-[80vh] p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreview(null)}
              className="absolute -top-2 -right-2 z-10 rounded-full bg-white/10 p-1.5 hover:bg-white/20 transition-colors"
            >
              <X className="h-4 w-4 text-white" />
            </button>
            <img
              src={`/api/files/${preview.id}`}
              alt={preview.filename}
              className="max-w-full max-h-[78vh] rounded-lg object-contain"
            />
            <p className="mt-2 text-center text-sm text-white/50">
              {preview.filename}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface CombinedFileListProps {
  cardFiles: FileAttachment[];
  projectFiles: FileAttachment[];
  onDeleteCardFile?: (fileId: string) => void;
  onDeleteProjectFile?: (fileId: string) => void;
}

export function FileList({
  cardFiles,
  projectFiles,
  onDeleteCardFile,
  onDeleteProjectFile,
}: CombinedFileListProps) {
  if (cardFiles.length === 0 && projectFiles.length === 0) {
    return (
      <p className="text-xs text-white/20 italic py-2">
        No files attached. Use the attach button or drag & drop files here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {cardFiles.length > 0 && (
        <FileListSection
          files={cardFiles}
          label="Card Files"
          onDelete={onDeleteCardFile}
        />
      )}
      {projectFiles.length > 0 && (
        <FileListSection
          files={projectFiles}
          label="Project Files"
          onDelete={onDeleteProjectFile}
          dimmed
        />
      )}
    </div>
  );
}
