import { db } from "@/lib/db";
import { checklistItems } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { IChecklistItemRepository, ChecklistItemRow } from "../types";

export class SqliteChecklistItemRepository implements IChecklistItemRepository {
  findByCardId(cardId: string): ChecklistItemRow[] {
    return db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.cardId, cardId))
      .orderBy(checklistItems.position)
      .all() as ChecklistItemRow[];
  }

  findById(id: string): ChecklistItemRow | undefined {
    return db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.id, id))
      .get() as ChecklistItemRow | undefined;
  }

  create(data: ChecklistItemRow): void {
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

  update(id: string, cardId: string, data: Partial<Pick<ChecklistItemRow, "text" | "checked" | "position">>): void {
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

  delete(id: string, cardId: string): void {
    db.delete(checklistItems)
      .where(and(eq(checklistItems.id, id), eq(checklistItems.cardId, cardId)))
      .run();
  }

  deleteByCardId(cardId: string): void {
    db.delete(checklistItems)
      .where(eq(checklistItems.cardId, cardId))
      .run();
  }
}
