import { db } from "@/lib/db";
import { boardInvites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { IBoardInviteRepository, BoardInviteRow } from "../types";

export class SqliteBoardInviteRepository implements IBoardInviteRepository {
  async findById(id: string): Promise<BoardInviteRow | undefined> {
    return db.select().from(boardInvites).where(eq(boardInvites.id, id)).get() as BoardInviteRow | undefined;
  }

  async findByProjectId(projectId: string): Promise<BoardInviteRow[]> {
    return db.select().from(boardInvites).where(eq(boardInvites.projectId, projectId)).all() as BoardInviteRow[];
  }

  async findByEmail(email: string): Promise<BoardInviteRow[]> {
    return db.select().from(boardInvites).where(eq(boardInvites.email, email)).all() as BoardInviteRow[];
  }

  async findPendingByEmail(email: string): Promise<BoardInviteRow[]> {
    return db
      .select()
      .from(boardInvites)
      .where(and(eq(boardInvites.email, email), eq(boardInvites.status, "pending")))
      .all() as BoardInviteRow[];
  }

  async create(data: Omit<BoardInviteRow, "id" | "status" | "createdAt"> & { id?: string }): Promise<BoardInviteRow> {
    const id = data.id ?? uuid();
    const createdAt = new Date().toISOString();
    const status = "pending";
    db.insert(boardInvites)
      .values({
        id,
        projectId: data.projectId,
        email: data.email,
        role: data.role,
        status,
        invitedBy: data.invitedBy,
        createdAt,
      })
      .run();
    return {
      id,
      projectId: data.projectId,
      email: data.email,
      role: data.role,
      status: "pending",
      invitedBy: data.invitedBy,
      createdAt,
    };
  }

  async update(id: string, data: Partial<Pick<BoardInviteRow, "status" | "role">>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.role !== undefined) updateData.role = data.role;
    if (Object.keys(updateData).length > 0) {
      db.update(boardInvites).set(updateData).where(eq(boardInvites.id, id)).run();
    }
  }

  async delete(id: string): Promise<void> {
    db.delete(boardInvites).where(eq(boardInvites.id, id)).run();
  }
}
