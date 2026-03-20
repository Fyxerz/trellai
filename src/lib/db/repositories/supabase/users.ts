import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { IUserRepository, UserRow } from "../types";

function toUserRow(row: Record<string, unknown>): UserRow {
  return {
    id: row.id as string,
    email: row.email as string,
    name: (row.name as string) ?? null,
    avatarUrl: (row.avatar_url as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export class SupabaseUserRepository implements IUserRepository {
  private _client: SupabaseClient | null;

  constructor(client?: SupabaseClient) {
    this._client = client ?? null;
  }

  private get client() {
    return this._client ?? getSupabaseClient();
  }

  async findById(id: string): Promise<UserRow | undefined> {
    const { data, error } = await this.client
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toUserRow(data) : undefined;
  }

  async findByEmail(email: string): Promise<UserRow | undefined> {
    const { data, error } = await this.client
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    return data ? toUserRow(data) : undefined;
  }

  async upsert(data: UserRow): Promise<void> {
    const { error } = await this.client.from("users").upsert({
      id: data.id,
      email: data.email,
      name: data.name,
      avatar_url: data.avatarUrl,
      created_at: data.createdAt,
    });
    if (error) throw error;
  }

  async update(id: string, data: Partial<Pick<UserRow, "name" | "avatarUrl">>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl;
    if (Object.keys(updateData).length > 0) {
      const { error } = await this.client.from("users").update(updateData).eq("id", id);
      if (error) throw error;
    }
  }
}
