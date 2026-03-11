import { useState, useEffect, useCallback } from "react";
import type { FileAttachment } from "@/types";

export function useFiles(opts: { projectId: string; cardId?: string }) {
  const [cardFiles, setCardFiles] = useState<FileAttachment[]>([]);
  const [projectFiles, setProjectFiles] = useState<FileAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchCardFiles = useCallback(async () => {
    if (!opts.cardId) return;
    try {
      const res = await fetch(`/api/cards/${opts.cardId}/files`);
      if (res.ok) setCardFiles(await res.json());
    } catch {
      // ignore
    }
  }, [opts.cardId]);

  const fetchProjectFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${opts.projectId}/files`);
      if (res.ok) setProjectFiles(await res.json());
    } catch {
      // ignore
    }
  }, [opts.projectId]);

  const refresh = useCallback(() => {
    fetchCardFiles();
    fetchProjectFiles();
  }, [fetchCardFiles, fetchProjectFiles]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const uploadCardFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (!opts.cardId) return;
      setUploading(true);
      try {
        const formData = new FormData();
        Array.from(fileList).forEach((f) => formData.append("files", f));
        const res = await fetch(`/api/cards/${opts.cardId}/files`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          await fetchCardFiles();
        }
      } finally {
        setUploading(false);
      }
    },
    [opts.cardId, fetchCardFiles]
  );

  const uploadProjectFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setUploading(true);
      try {
        const formData = new FormData();
        Array.from(fileList).forEach((f) => formData.append("files", f));
        const res = await fetch(`/api/projects/${opts.projectId}/files`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          await fetchProjectFiles();
        }
      } finally {
        setUploading(false);
      }
    },
    [opts.projectId, fetchProjectFiles]
  );

  const deleteFile = useCallback(
    async (fileId: string, scope: "card" | "project") => {
      const url =
        scope === "card" && opts.cardId
          ? `/api/cards/${opts.cardId}/files?fileId=${fileId}`
          : `/api/projects/${opts.projectId}/files?fileId=${fileId}`;
      await fetch(url, { method: "DELETE" });
      refresh();
    },
    [opts.cardId, opts.projectId, refresh]
  );

  return {
    cardFiles,
    projectFiles,
    uploading,
    uploadCardFiles,
    uploadProjectFiles,
    deleteFile,
    refresh,
  };
}
