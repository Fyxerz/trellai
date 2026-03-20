import { describe, it, expect } from "vitest";
import type { Card } from "@/types";

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    projectId: "proj-1",
    title: "Test Card",
    description: "",
    type: "feature",
    column: "features",
    position: 0,
    branchName: null,
    worktreePath: null,
    claudeSessionId: null,
    agentStatus: "idle",
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

/** Mimics the search filter logic used in Board.tsx */
function cardMatchesSearch(card: Card, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    card.title.toLowerCase().includes(q) ||
    card.description.toLowerCase().includes(q)
  );
}

describe("cardMatchesSearch", () => {
  const cards = [
    makeCard({ id: "1", title: "Add search bar", description: "Filter cards by title" }),
    makeCard({ id: "2", title: "Fix login bug", description: "Authentication fails on mobile" }),
    makeCard({ id: "3", title: "Update dashboard", description: "Add charts and metrics" }),
    makeCard({ id: "4", title: "Refactor API", description: "Clean up search endpoints" }),
  ];

  it("returns all cards when query is empty", () => {
    const results = cards.filter((c) => cardMatchesSearch(c, ""));
    expect(results).toHaveLength(4);
  });

  it("matches cards by title (case-insensitive)", () => {
    const results = cards.filter((c) => cardMatchesSearch(c, "search"));
    expect(results).toHaveLength(2);
    expect(results.map((c) => c.id)).toEqual(["1", "4"]);
  });

  it("matches cards by description", () => {
    const results = cards.filter((c) => cardMatchesSearch(c, "mobile"));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("2");
  });

  it("is case-insensitive", () => {
    const results = cards.filter((c) => cardMatchesSearch(c, "FIX"));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("2");
  });

  it("matches partial strings", () => {
    const results = cards.filter((c) => cardMatchesSearch(c, "dash"));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("3");
  });

  it("returns empty array when nothing matches", () => {
    const results = cards.filter((c) => cardMatchesSearch(c, "nonexistent"));
    expect(results).toHaveLength(0);
  });

  it("matches across both title and description", () => {
    // "search" appears in card 1's title and card 4's description
    const results = cards.filter((c) => cardMatchesSearch(c, "search"));
    expect(results).toHaveLength(2);
    expect(results.map((c) => c.id).sort()).toEqual(["1", "4"]);
  });
});
