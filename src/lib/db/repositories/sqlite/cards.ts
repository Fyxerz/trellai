import { db } from "@/lib/db";
import { cards } from "@/lib/db/schema";
import { eq, and, ne, inArray } from "drizzle-orm";
import type { ICardRepository, CardRow } from "../types";

export class SqliteCardRepository implements ICardRepository {
  findAll(): CardRow[] {
    return db.select().from(cards).all() as CardRow[];
  }

  findById(id: string): CardRow | undefined {
    return db.select().from(cards).where(eq(cards.id, id)).get() as CardRow | undefined;
  }

  findByProjectId(projectId: string): CardRow[] {
    return db.select().from(cards).where(eq(cards.projectId, projectId)).all() as CardRow[];
  }

  findByConditions(conditions: {
    projectId?: string;
    column?: string | string[];
    agentStatus?: string;
    notId?: string;
  }): CardRow[] {
    const clauses = [];
    if (conditions.projectId) clauses.push(eq(cards.projectId, conditions.projectId));
    if (conditions.column) {
      if (Array.isArray(conditions.column)) {
        clauses.push(inArray(cards.column, conditions.column));
      } else {
        clauses.push(eq(cards.column, conditions.column));
      }
    }
    if (conditions.agentStatus) clauses.push(eq(cards.agentStatus, conditions.agentStatus));
    if (conditions.notId) clauses.push(ne(cards.id, conditions.notId));

    if (clauses.length === 0) return db.select().from(cards).all() as CardRow[];
    if (clauses.length === 1) return db.select().from(cards).where(clauses[0]).all() as CardRow[];
    return db.select().from(cards).where(and(...clauses)).all() as CardRow[];
  }

  create(data: Omit<CardRow, "branchName" | "worktreePath" | "claudeSessionId" | "commitSha" | "testStatus" | "testResults"> & {
    branchName?: string | null;
    worktreePath?: string | null;
    claudeSessionId?: string | null;
    commitSha?: string | null;
    testStatus?: string | null;
    testResults?: string | null;
  }): void {
    db.insert(cards)
      .values({
        id: data.id,
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        type: data.type,
        column: data.column,
        position: data.position,
        agentStatus: data.agentStatus,
        branchName: data.branchName ?? null,
        worktreePath: data.worktreePath ?? null,
        claudeSessionId: data.claudeSessionId ?? null,
        commitSha: data.commitSha ?? null,
        testStatus: data.testStatus ?? null,
        testResults: data.testResults ?? null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      })
      .run();
  }

  update(id: string, data: Partial<Omit<CardRow, "id">>): void {
    if (Object.keys(data).length > 0) {
      db.update(cards).set(data).where(eq(cards.id, id)).run();
    }
  }

  delete(id: string): void {
    db.delete(cards).where(eq(cards.id, id)).run();
  }
}
