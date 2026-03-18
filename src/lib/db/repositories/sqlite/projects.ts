import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { IProjectRepository, ProjectRow } from "../types";

export class SqliteProjectRepository implements IProjectRepository {
  findAll(): ProjectRow[] {
    return db.select().from(projects).all() as ProjectRow[];
  }

  findById(id: string): ProjectRow | undefined {
    return db.select().from(projects).where(eq(projects.id, id)).get() as ProjectRow | undefined;
  }

  create(data: Omit<ProjectRow, "chatSessionId" | "storageMode"> & { storageMode?: string }): void {
    db.insert(projects)
      .values({
        id: data.id,
        name: data.name,
        repoPath: data.repoPath,
        mode: data.mode,
        storageMode: data.storageMode || "local",
        createdAt: data.createdAt,
      })
      .run();
  }

  update(id: string, data: Partial<Pick<ProjectRow, "name" | "mode" | "chatSessionId" | "storageMode">>): void {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.mode !== undefined) updateData.mode = data.mode;
    if (data.chatSessionId !== undefined) updateData.chatSessionId = data.chatSessionId;
    if (data.storageMode !== undefined) updateData.storageMode = data.storageMode;
    if (Object.keys(updateData).length > 0) {
      db.update(projects).set(updateData).where(eq(projects.id, id)).run();
    }
  }

  delete(id: string): void {
    db.delete(projects).where(eq(projects.id, id)).run();
  }
}
