import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { groupCardsByDate } from "../group-cards";
import type { Card } from "@/types";

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    projectId: "proj-1",
    title: "Test Card",
    description: "",
    type: "feature",
    column: "complete",
    position: 0,
    branchName: null,
    worktreePath: null,
    claudeSessionId: null,
    agentStatus: "complete",
    assignedTo: null,
    commitSha: null,
    testStatus: null,
    testResults: null,
    isIcebox: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("groupCardsByDate", () => {
  beforeEach(() => {
    // Fix the date to 2026-03-20 12:00:00 (Friday)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty array for no cards", () => {
    expect(groupCardsByDate([])).toEqual([]);
  });

  it("groups a card updated today into 'Today'", () => {
    const cards = [makeCard({ id: "1", updatedAt: "2026-03-20T10:00:00" })];
    const groups = groupCardsByDate(cards);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Today");
    expect(groups[0].defaultExpanded).toBe(true);
    expect(groups[0].cards).toHaveLength(1);
  });

  it("groups a card updated yesterday into 'Yesterday'", () => {
    const cards = [makeCard({ id: "1", updatedAt: "2026-03-19T15:00:00" })];
    const groups = groupCardsByDate(cards);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Yesterday");
    expect(groups[0].defaultExpanded).toBe(true);
  });

  it("groups a card from earlier this week into 'Earlier This Week'", () => {
    // 2026-03-20 is Friday, week starts Sunday 2026-03-15
    const cards = [makeCard({ id: "1", updatedAt: "2026-03-16T10:00:00" })]; // Monday
    const groups = groupCardsByDate(cards);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Earlier This Week");
    expect(groups[0].defaultExpanded).toBe(false);
  });

  it("groups older cards by week", () => {
    const cards = [makeCard({ id: "1", updatedAt: "2026-03-09T10:00:00" })]; // previous week
    const groups = groupCardsByDate(cards);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toMatch(/^Week of /);
    expect(groups[0].defaultExpanded).toBe(false);
  });

  it("creates multiple groups for cards across different periods", () => {
    const cards = [
      makeCard({ id: "1", updatedAt: "2026-03-20T10:00:00" }), // today
      makeCard({ id: "2", updatedAt: "2026-03-19T10:00:00" }), // yesterday
      makeCard({ id: "3", updatedAt: "2026-03-17T10:00:00" }), // earlier this week
      makeCard({ id: "4", updatedAt: "2026-03-09T10:00:00" }), // last week
      makeCard({ id: "5", updatedAt: "2026-03-02T10:00:00" }), // two weeks ago
    ];
    const groups = groupCardsByDate(cards);
    expect(groups).toHaveLength(5);
    expect(groups[0].label).toBe("Today");
    expect(groups[1].label).toBe("Yesterday");
    expect(groups[2].label).toBe("Earlier This Week");
    // The last two are week groups
    expect(groups[3].label).toMatch(/^Week of /);
    expect(groups[4].label).toMatch(/^Week of /);
  });

  it("sorts groups with today first and older weeks last", () => {
    const cards = [
      makeCard({ id: "old", updatedAt: "2026-03-02T10:00:00" }),
      makeCard({ id: "today", updatedAt: "2026-03-20T10:00:00" }),
    ];
    const groups = groupCardsByDate(cards);
    expect(groups[0].label).toBe("Today");
    expect(groups[groups.length - 1].label).toMatch(/^Week of /);
  });

  it("puts multiple cards in the same group", () => {
    const cards = [
      makeCard({ id: "1", updatedAt: "2026-03-20T10:00:00" }),
      makeCard({ id: "2", updatedAt: "2026-03-20T14:00:00" }),
      makeCard({ id: "3", updatedAt: "2026-03-20T08:00:00" }),
    ];
    const groups = groupCardsByDate(cards);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Today");
    expect(groups[0].cards).toHaveLength(3);
  });
});
