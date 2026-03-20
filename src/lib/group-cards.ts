import type { Card } from "@/types";

export interface CardGroup {
  label: string;
  cards: Card[];
  defaultExpanded: boolean;
  key: string;
}

/**
 * Group completed cards by time period:
 * - Today: expanded
 * - Yesterday: expanded
 * - Earlier this week: collapsed
 * - Previous weeks (by week): collapsed
 */
export function groupCardsByDate(cards: Card[]): CardGroup[] {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = startOfDay(new Date(today.getTime() - 86400000));
  const startOfWeek = getStartOfWeek(today);

  const buckets: Record<string, { label: string; cards: Card[]; defaultExpanded: boolean; sortKey: number }> = {};

  for (const card of cards) {
    const date = new Date(card.updatedAt);
    const dayStart = startOfDay(date);
    const ts = dayStart.getTime();

    let key: string;
    let label: string;
    let defaultExpanded: boolean;
    let sortKey: number;

    if (ts >= today.getTime()) {
      key = "today";
      label = "Today";
      defaultExpanded = true;
      sortKey = 0;
    } else if (ts >= yesterday.getTime()) {
      key = "yesterday";
      label = "Yesterday";
      defaultExpanded = true;
      sortKey = 1;
    } else if (ts >= startOfWeek.getTime()) {
      key = "this-week";
      label = "Earlier This Week";
      defaultExpanded = false;
      sortKey = 2;
    } else {
      // Group by week
      const weekStart = getStartOfWeek(dayStart);
      const weekKey = weekStart.toISOString().slice(0, 10);
      key = `week-${weekKey}`;
      label = formatWeekLabel(weekStart);
      defaultExpanded = false;
      // older weeks have smaller timestamps, so negating gives higher sortKey = sorted later
      sortKey = 3 + (today.getTime() - weekStart.getTime()) / 86400000;
    }

    if (!buckets[key]) {
      buckets[key] = { label, cards: [], defaultExpanded, sortKey };
    }
    buckets[key].cards.push(card);
  }

  // Sort groups: today first, then yesterday, then this week, then older weeks
  return Object.entries(buckets)
    .sort(([, a], [, b]) => a.sortKey - b.sortKey)
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      cards: bucket.cards,
      defaultExpanded: bucket.defaultExpanded,
    }));
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(weekStart: Date): string {
  return `Week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
