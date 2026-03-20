import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { IUserRepository, UserRow } from "../types";

export class SqliteUserRepository implements IUserRepository {
  async findById(id: string): Promise<UserRow | undefined> {
    return db.select().from(users).where(eq(users.id, id)).get() as UserRow | undefined;
  }

  async findByEmail(email: string): Promise<UserRow | undefined> {
    return db.select().from(users).where(eq(users.email, email)).get() as UserRow | undefined;
  }

  async upsert(data: UserRow): Promise<void> {
    const existing = await this.findById(data.id);
    if (existing) {
      db.update(users)
        .set({
          email: data.email,
          name: data.name,
          avatarUrl: data.avatarUrl,
        })
        .where(eq(users.id, data.id))
        .run();
    } else {
      db.insert(users)
        .values({
          id: data.id,
          email: data.email,
          name: data.name,
          avatarUrl: data.avatarUrl,
          createdAt: data.createdAt,
        })
        .run();
    }
  }

  async update(id: string, data: Partial<Pick<UserRow, "name" | "avatarUrl">>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (Object.keys(updateData).length > 0) {
      db.update(users).set(updateData).where(eq(users.id, id)).run();
    }
  }
}
