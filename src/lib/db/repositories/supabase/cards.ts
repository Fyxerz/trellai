import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ICardRepository, CardRow } from "../types";

/** Map a Supabase snake_case row to our camelCase CardRow */
function toCardRow(row: Record<string, unknown>): CardRow {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    title: row.title as string,
    description: row.description as string,
    type: row.type as string,
    column: row.column as string,
    position: row.position as number,
    branchName: (row.branch_name as string) ?? null,
    worktreePath: (row.worktree_path as string) ?? null,
    claudeSessionId: (row.claude_session_id as string) ?? null,
    agentStatus: row.agent_status as string,
    assignedTo: (row.assigned_to as string) ?? null,
    commitSha: (row.commit_sha as string) ?? null,
    testStatus: (row.test_status as string) ?? null,
    testResults: (row.test_results as string) ?? null,
    isIcebox: (row.is_icebox as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Map camelCase partial data to snake_case for Supabase update */
function toSnakeCase(data: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = {
    projectId: "project_id",
    branchName: "branch_name",
    worktreePath: "worktree_path",
    claudeSessionId: "claude_session_id",
    agentStatus: "agent_status",
    assignedTo: "assigned_to",
    commitSha: "commit_sha",
    testStatus: "test_status",
    testResults: "test_results",
    isIcebox: "is_icebox",
    createdAt: "created_at",
    updatedAt: "updated_at",
  };
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    result[map[key] || key] = value;
  }
  return result;
}

export class SupabaseCardRepository implements ICardRepository {
  private _client: SupabaseClient | null;

  constructor(client?: SupabaseClient) {
    this._client = client ?? null;
  }

  private get client() {
    return this._client ?? getSupabaseClient();
  }

  async findAll(): Promise<CardRow[]> {
    const { data, error } = await this.client.from("cards").select("*");
    if (error) throw error;
    return (data ?? []).map(toCardRow);
  }

  async findById(id: string): Promise<CardRow | undefined> {
    const { data, error } = await this.client
      .from("cards")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toCardRow(data) : undefined;
  }

  async findByProjectId(projectId: string): Promise<CardRow[]> {
    const { data, error } = await this.client
      .from("cards")
      .select("*")
      .eq("project_id", projectId);
    if (error) throw error;
    return (data ?? []).map(toCardRow);
  }

  async findByConditions(conditions: {
    projectId?: string;
    column?: string | string[];
    agentStatus?: string;
    notId?: string;
  }): Promise<CardRow[]> {
    let query = this.client.from("cards").select("*");

    if (conditions.projectId) {
      query = query.eq("project_id", conditions.projectId);
    }
    if (conditions.column) {
      if (Array.isArray(conditions.column)) {
        query = query.in("column", conditions.column);
      } else {
        query = query.eq("column", conditions.column);
      }
    }
    if (conditions.agentStatus) {
      query = query.eq("agent_status", conditions.agentStatus);
    }
    if (conditions.notId) {
      query = query.neq("id", conditions.notId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toCardRow);
  }

  async create(data: Omit<CardRow, "branchName" | "worktreePath" | "claudeSessionId" | "assignedTo" | "commitSha" | "testStatus" | "testResults"> & {
    branchName?: string | null;
    worktreePath?: string | null;
    claudeSessionId?: string | null;
    assignedTo?: string | null;
    commitSha?: string | null;
    testStatus?: string | null;
    testResults?: string | null;
  }): Promise<void> {
    const { error } = await this.client.from("cards").insert({
      id: data.id,
      project_id: data.projectId,
      title: data.title,
      description: data.description,
      type: data.type,
      column: data.column,
      position: data.position,
      agent_status: data.agentStatus,
      branch_name: data.branchName ?? null,
      worktree_path: data.worktreePath ?? null,
      claude_session_id: data.claudeSessionId ?? null,
      assigned_to: data.assignedTo ?? null,
      commit_sha: data.commitSha ?? null,
      test_status: data.testStatus ?? null,
      test_results: data.testResults ?? null,
      created_at: data.createdAt,
      updated_at: data.updatedAt,
    });
    if (error) throw error;
  }

  async update(id: string, data: Partial<Omit<CardRow, "id">>): Promise<void> {
    if (Object.keys(data).length > 0) {
      const { error } = await this.client
        .from("cards")
        .update(toSnakeCase(data as Record<string, unknown>))
        .eq("id", id);
      if (error) throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("cards").delete().eq("id", id);
    if (error) throw error;
  }
}
