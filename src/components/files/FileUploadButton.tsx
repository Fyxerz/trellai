"use client";
import { useRef } from "react";
import { Paperclip, Loader2 } from "lucide-react";

interface FileUploadButtonProps {
  onUpload: (files: FileList) => Promise<void>;
  uploading?: boolean;
  variant?: "default" | "icon";
}

export function FileUploadButton({
  onUpload,
  uploading,
  variant = "default",
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await onUpload(files);
    // Reset so the same file can be uploaded again
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleChange}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={
          variant === "icon"
            ? "flex items-center justify-center h-8 w-8 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50"
            : "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50"
        }
        title="Attach files"
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Paperclip className="h-3.5 w-3.5" />
        )}
        {variant === "default" && (
          <span>{uploading ? "Uploading..." : "Attach"}</span>
        )}
      </button>
    </>
  );
}
