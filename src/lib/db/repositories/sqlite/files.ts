import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { IFileRepository, FileRow } from "../types";

export class SqliteFileRepository implements IFileRepository {
  async findById(id: string): Promise<FileRow | undefined> {
    return db.select().from(files).where(eq(files.id, id)).get() as FileRow | undefined;
  }

  async findByCardId(cardId: string): Promise<FileRow[]> {
    return db.select().from(files).where(eq(files.cardId, cardId)).all() as FileRow[];
  }

  async findByProjectId(projectId: string): Promise<FileRow[]> {
    return db
      .select()
      .from(files)
      .where(and(eq(files.projectId, projectId), isNull(files.cardId)))
      .all() as FileRow[];
  }

  async findByIdAndCardId(id: string, cardId: string): Promise<FileRow | undefined> {
    return db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.cardId, cardId)))
      .get() as FileRow | undefined;
  }

  async findByIdAndProjectId(id: string, projectId: string): Promise<FileRow | undefined> {
    return db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.projectId, projectId), isNull(files.cardId)))
      .get() as FileRow | undefined;
  }

  async create(data: FileRow): Promise<void> {
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

  async delete(id: string): Promise<void> {
    db.delete(files).where(eq(files.id, id)).run();
  }

  async deleteByCardId(cardId: string): Promise<void> {
    db.delete(files).where(eq(files.cardId, cardId)).run();
  }
}
