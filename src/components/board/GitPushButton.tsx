"use client";
import { useState, useEffect, useCallback } from "react";
import { GitBranch, Loader2, Check, AlertCircle } from "lucide-react";

interface GitPushButtonProps {
  projectId: string;
}

type PushState = "idle" | "loading" | "success" | "error";

export function GitPushButton({ projectId }: GitPushButtonProps) {
  const [hasOrigin, setHasOrigin] = useState<boolean | null>(null);
  const [pushState, setPushState] = useState<PushState>("idle");
  const [message, setMessage] = useState<string>("");

  const checkRemoteStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/remote-status`);
      if (res.ok) {
        const data = await res.json();
        setHasOrigin(data.hasOrigin);
      }
    } catch {
      setHasOrigin(false);
    }
  }, [projectId]);

  useEffect(() => {
    checkRemoteStatus();
  }, [checkRemoteStatus]);

  const handlePush = async () => {
    if (pushState === "loading" || !hasOrigin) return;

    setPushState("loading");
    setMessage("");

    try {
      const res = await fetch(`/api/projects/${projectId}/push`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const sha = data.commitSha ? ` (${data.commitSha})` : "";
        setMessage(`Pushed to origin/${data.branch}${sha}`);
        setPushState("success");
      } else {
        setMessage(data.error || "Push failed");
        setPushState("error");
      }
    } catch {
      setMessage("Network error");
      setPushState("error");
    }

    // Reset to idle after 4 seconds
    setTimeout(() => {
      setPushState("idle");
      setMessage("");
    }, 4000);
  };

  const disabled = hasOrigin === false || pushState === "loading";

  const icon =
    pushState === "loading" ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
    ) : pushState === "success" ? (
      <Check className="h-3.5 w-3.5" />
    ) : pushState === "error" ? (
      <AlertCircle className="h-3.5 w-3.5" />
    ) : (
      <GitBranch className="h-3.5 w-3.5" />
    );

  const stateStyles =
    pushState === "success"
      ? "bg-emerald-500/20 text-emerald-300"
      : pushState === "error"
        ? "bg-red-500/20 text-red-300"
        : disabled
          ? "bg-white/5 text-white/25 cursor-not-allowed"
          : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80";

  return (
    <div className="relative">
      <button
        onClick={handlePush}
        disabled={disabled}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${stateStyles}`}
        title={
          hasOrigin === false
            ? "No origin remote configured"
            : pushState === "loading"
              ? "Pushing..."
              : message || "Push main branch to origin"
        }
      >
        {icon}
        {pushState === "loading"
          ? "Pushing..."
          : pushState === "success"
            ? "Pushed"
            : pushState === "error"
              ? "Failed"
              : "Push"}
      </button>
      {message && pushState !== "idle" && (
        <div
          className={`absolute top-full right-0 mt-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs shadow-lg z-50 ${
            pushState === "success"
              ? "bg-emerald-900/90 text-emerald-200"
              : "bg-red-900/90 text-red-200"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
