import { db } from "@/lib/db";
import { checklistItems } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { IChecklistItemRepository, ChecklistItemRow } from "../types";

export class SqliteChecklistItemRepository implements IChecklistItemRepository {
  async findByCardId(cardId: string): Promise<ChecklistItemRow[]> {
    return db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.cardId, cardId))
      .orderBy(checklistItems.position)
      .all() as ChecklistItemRow[];
  }

  async findById(id: string): Promise<ChecklistItemRow | undefined> {
    return db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.id, id))
      .get() as ChecklistItemRow | undefined;
  }

  async create(data: ChecklistItemRow): Promise<void> {
    db.insert(checklistItems)
      .values({
        id: data.id,
        cardId: data.cardId,
        text: data.text,
        checked: data.checked,
        position: data.position,
        createdAt: data.createdAt,
      })
      .run();
  }

  async update(id: string, cardId: string, data: Partial<Pick<ChecklistItemRow, "text" | "checked" | "position">>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.text !== undefined) updateData.text = data.text;
    if (data.checked !== undefined) updateData.checked = data.checked;
    if (data.position !== undefined) updateData.position = data.position;
    if (Object.keys(updateData).length > 0) {
      db.update(checklistItems)
        .set(updateData)
        .where(and(eq(checklistItems.id, id), eq(checklistItems.cardId, cardId)))
        .run();
    }
  }

  async delete(id: string, cardId: string): Promise<void> {
    db.delete(checklistItems)
      .where(and(eq(checklistItems.id, id), eq(checklistItems.cardId, cardId)))
      .run();
  }

  async deleteByCardId(cardId: string): Promise<void> {
    db.delete(checklistItems)
      .where(eq(checklistItems.cardId, cardId))
      .run();
  }
}
