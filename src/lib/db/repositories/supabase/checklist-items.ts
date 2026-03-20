import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { IChecklistItemRepository, ChecklistItemRow } from "../types";

function toChecklistItemRow(row: Record<string, unknown>): ChecklistItemRow {
  return {
    id: row.id as string,
    cardId: row.card_id as string,
    text: row.text as string,
    checked: row.checked as boolean,
    position: row.position as number,
    createdAt: row.created_at as string,
  };
}

export class SupabaseChecklistItemRepository implements IChecklistItemRepository {
  private _client: SupabaseClient | null;

  constructor(client?: SupabaseClient) {
    this._client = client ?? null;
  }

  private get client() {
    return this._client ?? getSupabaseClient();
  }

  async findByCardId(cardId: string): Promise<ChecklistItemRow[]> {
    const { data, error } = await this.client
      .from("checklist_items")
      .select("*")
      .eq("card_id", cardId)
      .order("position", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toChecklistItemRow);
  }

  async findById(id: string): Promise<ChecklistItemRow | undefined> {
    const { data, error } = await this.client
      .from("checklist_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toChecklistItemRow(data) : undefined;
  }

  async create(data: ChecklistItemRow): Promise<void> {
    const { error } = await this.client.from("checklist_items").insert({
      id: data.id,
      card_id: data.cardId,
      text: data.text,
      checked: data.checked,
      position: data.position,
      created_at: data.createdAt,
    });
    if (error) throw error;
  }

  async update(id: string, cardId: string, data: Partial<Pick<ChecklistItemRow, "text" | "checked" | "position">>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.text !== undefined) updateData.text = data.text;
    if (data.checked !== undefined) updateData.checked = data.checked;
    if (data.position !== undefined) updateData.position = data.position;
    if (Object.keys(updateData).length > 0) {
      const { error } = await this.client
        .from("checklist_items")
        .update(updateData)
        .eq("id", id)
        .eq("card_id", cardId);
      if (error) throw error;
    }
  }

  async delete(id: string, cardId: string): Promise<void> {
    const { error } = await this.client
      .from("checklist_items")
      .delete()
      .eq("id", id)
      .eq("card_id", cardId);
    if (error) throw error;
  }

  async deleteByCardId(cardId: string): Promise<void> {
    const { error } = await this.client
      .from("checklist_items")
      .delete()
      .eq("card_id", cardId);
    if (error) throw error;
  }
}
