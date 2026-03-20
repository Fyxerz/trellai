"use client";

import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/app/(auth)/actions";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, LogIn } from "lucide-react";

/**
 * Avatar with user initial or OAuth avatar image.
 */
function UserAvatar({
  user,
  showOnlineDot,
}: {
  user: { email?: string; user_metadata?: Record<string, string> };
  showOnlineDot?: boolean;
}) {
  const avatarUrl = user.user_metadata?.avatar_url;
  const initial = (user.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="relative">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt="Avatar"
          className="h-9 w-9 rounded-full ring-2 ring-white/20 object-cover"
        />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 ring-2 ring-white/20 text-sm font-bold text-white">
          {initial}
        </div>
      )}
      {showOnlineDot && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0f0f14]" />
      )}
    </div>
  );
}

interface UserMenuProps {
  /** Whether the user is online in the presence system */
  isOnline?: boolean;
}

export function UserMenu({ isOnline }: UserMenuProps) {
  const { user, loading, isAnonymous, isAuthConfigured } = useAuth();

  // Loading state
  if (loading) {
    return (
      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 ring-2 ring-white/20 animate-pulse" />
    );
  }

  // Anonymous user -- show Sign In button (only if Supabase is configured)
  if (isAnonymous) {
    if (!isAuthConfigured) return null;
    return (
      <Link
        href="/login"
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      >
        <LogIn className="h-4 w-4" />
        Sign In
      </Link>
    );
  }

  // Authenticated user -- show avatar dropdown with online dot
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-full">
        <UserAvatar user={user!} showOnlineDot={isOnline} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-foreground truncate">
            {user!.user_metadata?.full_name ?? user!.email}
          </p>
          {user!.user_metadata?.full_name && (
            <p className="text-xs text-muted-foreground truncate">
              {user!.email}
            </p>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2">
          <User className="h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-destructive focus:text-destructive"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
