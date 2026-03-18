import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { IFileRepository, FileRow } from "../types";

export class SqliteFileRepository implements IFileRepository {
  findById(id: string): FileRow | undefined {
    return db.select().from(files).where(eq(files.id, id)).get() as FileRow | undefined;
  }

  findByCardId(cardId: string): FileRow[] {
    return db.select().from(files).where(eq(files.cardId, cardId)).all() as FileRow[];
  }

  findByProjectId(projectId: string): FileRow[] {
    return db
      .select()
      .from(files)
      .where(and(eq(files.projectId, projectId), isNull(files.cardId)))
      .all() as FileRow[];
  }

  findByIdAndCardId(id: string, cardId: string): FileRow | undefined {
    return db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.cardId, cardId)))
      .get() as FileRow | undefined;
  }

  findByIdAndProjectId(id: string, projectId: string): FileRow | undefined {
    return db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.projectId, projectId), isNull(files.cardId)))
      .get() as FileRow | undefined;
  }

  create(data: FileRow): void {
    db.insert(files)
      .values({
        id: data.id,
        projectId: data.projectId,
        cardId: data.cardId,
        filename: data.filename,
        storedPath: data.storedPath,
        mimeType: data.mimeType,
        size: data.size,
        createdAt: data.createdAt,
      })
      .run();
  }

  delete(id: string): void {
    db.delete(files).where(eq(files.id, id)).run();
  }

  deleteByCardId(cardId: string): void {
    db.delete(files).where(eq(files.cardId, cardId)).run();
  }
}
