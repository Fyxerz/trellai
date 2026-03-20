"use client";

import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/app/(auth)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";

/**
 * Avatar with user initial or OAuth avatar image.
 */
function UserAvatar({ user }: { user: { email?: string; user_metadata?: Record<string, string> } }) {
  const avatarUrl = user.user_metadata?.avatar_url;
  const initial = (user.email?.[0] ?? "U").toUpperCase();

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt="Avatar"
        className="h-9 w-9 rounded-full ring-2 ring-white/20 object-cover"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 ring-2 ring-white/20 text-sm font-bold text-white">
      {initial}
    </div>
  );
}

export function UserMenu() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 ring-2 ring-white/20 animate-pulse" />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-full">
        <UserAvatar user={user} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-foreground truncate">
            {user.user_metadata?.full_name ?? user.email}
          </p>
          {user.user_metadata?.full_name && (
            <p className="text-xs text-muted-foreground truncate">
              {user.email}
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
