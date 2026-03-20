import { db } from "@/lib/db";
import { teamMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { ITeamMemberRepository, TeamMemberRow } from "../types";

export class SqliteTeamMemberRepository implements ITeamMemberRepository {
  async findByTeamId(teamId: string): Promise<TeamMemberRow[]> {
    return db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId)).all() as TeamMemberRow[];
  }

  async findByUserId(userId: string): Promise<TeamMemberRow[]> {
    return db.select().from(teamMembers).where(eq(teamMembers.userId, userId)).all() as TeamMemberRow[];
  }

  async findByTeamAndUser(teamId: string, userId: string): Promise<TeamMemberRow | undefined> {
    return db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .get() as TeamMemberRow | undefined;
  }

  async create(data: Omit<TeamMemberRow, "id" | "createdAt"> & { id?: string }): Promise<void> {
    db.insert(teamMembers)
      .values({
        id: data.id ?? uuid(),
        teamId: data.teamId,
        userId: data.userId,
        role: data.role,
        createdAt: new Date().toISOString(),
      })
      .run();
  }

  async update(id: string, data: Partial<Pick<TeamMemberRow, "role">>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.role !== undefined) updateData.role = data.role;
    if (Object.keys(updateData).length > 0) {
      db.update(teamMembers).set(updateData).where(eq(teamMembers.id, id)).run();
    }
  }

  async delete(id: string): Promise<void> {
    db.delete(teamMembers).where(eq(teamMembers.id, id)).run();
  }

  async deleteByTeamAndUser(teamId: string, userId: string): Promise<void> {
    db.delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .run();
  }
}
