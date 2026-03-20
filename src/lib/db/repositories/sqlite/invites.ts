import { db } from "@/lib/db";
import { invites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { IInviteRepository, InviteRow } from "../types";

export class SqliteInviteRepository implements IInviteRepository {
  async findById(id: string): Promise<InviteRow | undefined> {
    return db.select().from(invites).where(eq(invites.id, id)).get() as InviteRow | undefined;
  }

  async findByTeamId(teamId: string): Promise<InviteRow[]> {
    return db.select().from(invites).where(eq(invites.teamId, teamId)).all() as InviteRow[];
  }

  async findByEmail(email: string): Promise<InviteRow[]> {
    return db.select().from(invites).where(eq(invites.email, email)).all() as InviteRow[];
  }

  async findPendingByEmail(email: string): Promise<InviteRow[]> {
    return db
      .select()
      .from(invites)
      .where(and(eq(invites.email, email), eq(invites.status, "pending")))
      .all() as InviteRow[];
  }

  async create(data: Omit<InviteRow, "id" | "status" | "createdAt"> & { id?: string }): Promise<InviteRow> {
    const id = data.id ?? uuid();
    const createdAt = new Date().toISOString();
    const status = "pending";
    db.insert(invites)
      .values({
        id,
        teamId: data.teamId,
        email: data.email,
        role: data.role,
        status,
        invitedBy: data.invitedBy,
        createdAt,
      })
      .run();
    return {
      id,
      teamId: data.teamId,
      email: data.email,
      role: data.role,
      status,
      invitedBy: data.invitedBy,
      createdAt,
    };
  }

  async update(id: string, data: Partial<Pick<InviteRow, "status" | "role">>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.role !== undefined) updateData.role = data.role;
    if (Object.keys(updateData).length > 0) {
      db.update(invites).set(updateData).where(eq(invites.id, id)).run();
    }
  }

  async delete(id: string): Promise<void> {
    db.delete(invites).where(eq(invites.id, id)).run();
  }
}
