import { getSupabaseClient } from "@/lib/supabase/client";
import type { IFileRepository, FileRow } from "../types";

function toFileRow(row: Record<string, unknown>): FileRow {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    cardId: (row.card_id as string) ?? null,
    filename: row.filename as string,
    storedPath: row.stored_path as string,
    mimeType: row.mime_type as string,
    size: row.size as number,
    createdAt: row.created_at as string,
  };
}

export class SupabaseFileRepository implements IFileRepository {
  private get client() {
    return getSupabaseClient();
  }

  async findById(id: string): Promise<FileRow | undefined> {
    const { data, error } = await this.client
      .from("files")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toFileRow(data) : undefined;
  }

  async findByCardId(cardId: string): Promise<FileRow[]> {
    const { data, error } = await this.client
      .from("files")
      .select("*")
      .eq("card_id", cardId);
    if (error) throw error;
    return (data ?? []).map(toFileRow);
  }

  async findByProjectId(projectId: string): Promise<FileRow[]> {
    const { data, error } = await this.client
      .from("files")
      .select("*")
      .eq("project_id", projectId)
      .is("card_id", null);
    if (error) throw error;
    return (data ?? []).map(toFileRow);
  }

  async findByIdAndCardId(id: string, cardId: string): Promise<FileRow | undefined> {
    const { data, error } = await this.client
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("card_id", cardId)
      .maybeSingle();
    if (error) throw error;
    return data ? toFileRow(data) : undefined;
  }

  async findByIdAndProjectId(id: string, projectId: string): Promise<FileRow | undefined> {
    const { data, error } = await this.client
      .from("files")
      .select("*")
      .eq("id", id)
      .eq("project_id", projectId)
      .is("card_id", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toFileRow(data) : undefined;
  }

  async create(data: FileRow): Promise<void> {
    const { error } = await this.client.from("files").insert({
      id: data.id,
      project_id: data.projectId,
      card_id: data.cardId,
      filename: data.filename,
      stored_path: data.storedPath,
      mime_type: data.mimeType,
      size: data.size,
      created_at: data.createdAt,
    });
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("files").delete().eq("id", id);
    if (error) throw error;
  }

  async deleteByCardId(cardId: string): Promise<void> {
    const { error } = await this.client.from("files").delete().eq("card_id", cardId);
    if (error) throw error;
  }
}
