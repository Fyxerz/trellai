import { db } from "@/lib/db";
import { boardCollaborators } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { IBoardCollaboratorRepository, BoardCollaboratorRow } from "../types";

export class SqliteBoardCollaboratorRepository implements IBoardCollaboratorRepository {
  async findByProjectId(projectId: string): Promise<BoardCollaboratorRow[]> {
    return db.select().from(boardCollaborators).where(eq(boardCollaborators.projectId, projectId)).all() as BoardCollaboratorRow[];
  }

  async findByUserId(userId: string): Promise<BoardCollaboratorRow[]> {
    return db.select().from(boardCollaborators).where(eq(boardCollaborators.userId, userId)).all() as BoardCollaboratorRow[];
  }

  async findByProjectAndUser(projectId: string, userId: string): Promise<BoardCollaboratorRow | undefined> {
    return db
      .select()
      .from(boardCollaborators)
      .where(and(eq(boardCollaborators.projectId, projectId), eq(boardCollaborators.userId, userId)))
      .get() as BoardCollaboratorRow | undefined;
  }

  async findById(id: string): Promise<BoardCollaboratorRow | undefined> {
    return db.select().from(boardCollaborators).where(eq(boardCollaborators.id, id)).get() as BoardCollaboratorRow | undefined;
  }

  async create(data: Omit<BoardCollaboratorRow, "id" | "createdAt"> & { id?: string }): Promise<BoardCollaboratorRow> {
    const id = data.id ?? uuid();
    const createdAt = new Date().toISOString();
    db.insert(boardCollaborators)
      .values({
        id,
        projectId: data.projectId,
        userId: data.userId,
        role: data.role,
        createdAt,
      })
      .run();
    return {
      id,
      projectId: data.projectId,
      userId: data.userId,
      role: data.role,
      createdAt,
    };
  }

  async update(id: string, data: Partial<Pick<BoardCollaboratorRow, "role">>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.role !== undefined) updateData.role = data.role;
    if (Object.keys(updateData).length > 0) {
      db.update(boardCollaborators).set(updateData).where(eq(boardCollaborators.id, id)).run();
    }
  }

  async delete(id: string): Promise<void> {
    db.delete(boardCollaborators).where(eq(boardCollaborators.id, id)).run();
  }
}
