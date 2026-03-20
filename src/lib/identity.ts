"use client";

import { v4 as uuid } from "uuid";

const STORAGE_KEY = "trellai:user-identity";

const COLORS = [
  "#8B5CF6", // violet
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
  "#6366F1", // indigo
  "#14B8A6", // teal
];

const ANIMALS = [
  "Fox", "Owl", "Bear", "Wolf", "Hawk",
  "Lynx", "Panda", "Otter", "Raven", "Cobra",
  "Eagle", "Bison", "Crane", "Heron", "Tiger",
];

export interface UserIdentity {
  id: string;
  name: string;
  color: string;
}

function generateName(): string {
  const adj = ["Swift", "Bright", "Calm", "Bold", "Keen", "Sage", "Wild", "Warm"];
  const a = adj[Math.floor(Math.random() * adj.length)];
  const b = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${a} ${b}`;
}

function pickColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

/**
 * Get or create a persistent user identity from localStorage.
 * Falls back to an in-memory identity for SSR or environments without localStorage.
 */
export function getUserIdentity(): UserIdentity {
  if (typeof window === "undefined") {
    return { id: "ssr", name: "Anonymous", color: COLORS[0] };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as UserIdentity;
      if (parsed.id && parsed.name && parsed.color) return parsed;
    }
  } catch {
    // corrupt or missing
  }

  const identity: UserIdentity = {
    id: uuid(),
    name: generateName(),
    color: pickColor(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // storage full or disabled
  }

  return identity;
}

/**
 * Update the display name of the current user.
 */
export function setUserName(name: string): UserIdentity {
  const identity = getUserIdentity();
  identity.name = name.trim() || identity.name;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // ignore
  }
  return identity;
}

/**
 * Get initials from a name (up to 2 characters).
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
