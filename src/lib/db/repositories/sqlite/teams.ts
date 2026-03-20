import { db } from "@/lib/db";
import { teams, teamMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { ITeamRepository, TeamRow } from "../types";

export class SqliteTeamRepository implements ITeamRepository {
  async findById(id: string): Promise<TeamRow | undefined> {
    return db.select().from(teams).where(eq(teams.id, id)).get() as TeamRow | undefined;
  }

  async findByUserId(userId: string): Promise<TeamRow[]> {
    const rows = db
      .select({ teams })
      .from(teams)
      .innerJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId))
      .all();
    return rows.map((r) => r.teams as unknown as TeamRow);
  }

  async findPersonalTeam(userId: string): Promise<TeamRow | undefined> {
    const rows = db
      .select({ teams })
      .from(teams)
      .innerJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(and(eq(teamMembers.userId, userId), eq(teams.isPersonal, true)))
      .all();
    return rows.length > 0 ? (rows[0].teams as unknown as TeamRow) : undefined;
  }

  async create(data: Omit<TeamRow, "id" | "createdAt"> & { id?: string }): Promise<TeamRow> {
    const id = data.id ?? uuid();
    const createdAt = new Date().toISOString();
    db.insert(teams)
      .values({
        id,
        name: data.name,
        isPersonal: data.isPersonal,
        createdAt,
      })
      .run();
    return { id, name: data.name, isPersonal: data.isPersonal, createdAt };
  }

  async update(id: string, data: Partial<Pick<TeamRow, "name">>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (Object.keys(updateData).length > 0) {
      db.update(teams).set(updateData).where(eq(teams.id, id)).run();
    }
  }

  async delete(id: string): Promise<void> {
    db.delete(teams).where(eq(teams.id, id)).run();
  }
}
