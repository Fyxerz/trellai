"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Users } from "lucide-react";

/**
 * Subtle banner shown to anonymous users encouraging them to sign in
 * for collaboration features. Dismissible for the session.
 */
export function SignInBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative z-20 mx-8 mt-2 mb-0">
      <div className="flex items-center justify-between rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-2.5">
        <div className="flex items-center gap-3 text-sm text-white/60">
          <Users className="h-4 w-4 text-violet-400 shrink-0" />
          <span>
            Want to collaborate?{" "}
            <Link
              href="/login"
              className="font-medium text-violet-400 hover:text-violet-300 underline underline-offset-2"
            >
              Sign in
            </Link>{" "}
            or{" "}
            <Link
              href="/register"
              className="font-medium text-violet-400 hover:text-violet-300 underline underline-offset-2"
            >
              create an account
            </Link>{" "}
            to share boards and work with your team.
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="ml-4 rounded-lg p-1 text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
