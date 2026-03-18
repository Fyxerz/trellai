"use client";
import { useState, useCallback } from "react";
import { X, Save, Loader2, FileEdit, RefreshCw } from "lucide-react";
import { FileTree } from "./FileTree";
import { CodeEditor } from "./CodeEditor";

interface FileEditorDrawerProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export function FileEditorDrawer({ projectId, open, onClose }: FileEditorDrawerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [editedContent, setEditedContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadFile = useCallback(
    async (filePath: string) => {
      setLoading(true);
      setError(null);
      setSaved(false);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/repo-files?file=${encodeURIComponent(filePath)}`
        );
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load file");
          return;
        }
        const data = await res.json();
        setFileContent(data.content);
        setEditedContent(data.content);
        setSelectedFile(filePath);
        setDirty(false);
      } catch {
        setError("Failed to load file");
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  const handleSelectFile = useCallback(
    (filePath: string) => {
      if (dirty) {
        const discard = window.confirm(
          "You have unsaved changes. Discard and open another file?"
        );
        if (!discard) return;
      }
      loadFile(filePath);
    },
    [dirty, loadFile]
  );

  const handleSave = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/repo-files`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: selectedFile, content: editedContent }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }
      setFileContent(editedContent);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save file");
    } finally {
      setSaving(false);
    }
  }, [projectId, selectedFile, editedContent]);

  const handleEditorChange = useCallback(
    (content: string) => {
      setEditedContent(content);
      setDirty(content !== fileContent);
    },
    [fileContent]
  );

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl transform flex-col bg-[#1a1b26] shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <FileEdit className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-medium text-white/90">File Editor</h2>
            {selectedFile && (
              <span className="ml-2 rounded bg-white/5 px-2 py-0.5 text-xs text-white/50 font-mono">
                {selectedFile}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedFile && (
              <>
                <button
                  onClick={() => loadFile(selectedFile)}
                  className="rounded-md p-1.5 text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors"
                  title="Reload file"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    dirty
                      ? "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"
                      : saved
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-white/5 text-white/30"
                  }`}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {saving ? "Saving..." : saved ? "Saved & Committed!" : "Save"}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* File tree sidebar */}
          <div className="w-60 shrink-0 overflow-y-auto border-r border-white/5 bg-[#16171f]">
            <div className="sticky top-0 bg-[#16171f] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/30 border-b border-white/5">
              Files
            </div>
            <FileTree
              projectId={projectId}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
            />
          </div>

          {/* Editor area */}
          <div className="flex-1 flex flex-col min-w-0">
            {error && (
              <div className="mx-4 mt-2 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300 border border-red-500/20">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white/20" />
              </div>
            ) : selectedFile ? (
              <div className="flex-1 min-h-0">
                <CodeEditor
                  content={fileContent}
                  filename={selectedFile}
                  onChange={handleEditorChange}
                />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <FileEdit className="mx-auto h-12 w-12 text-white/10" />
                  <p className="mt-3 text-sm text-white/30">
                    Select a file from the tree to edit
                  </p>
                  <p className="mt-1 text-xs text-white/15">
                    Changes will be saved to disk and auto-committed
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status bar */}
        {selectedFile && (
          <div className="flex items-center justify-between border-t border-white/5 px-4 py-1.5 text-xs text-white/30">
            <span>
              {dirty ? (
                <span className="text-amber-400/60">● Modified</span>
              ) : (
                <span className="text-emerald-400/50">✓ Saved</span>
              )}
            </span>
            <span className="font-mono">{selectedFile.split(".").pop()?.toUpperCase() || "TXT"}</span>
          </div>
        )}
      </div>
    </>
  );
}
