/**
 * Supabase client utilities.
 *
 * - Browser client: use `createBrowserSupabaseClient` from `./browser`
 * - Server client:  use `createServerSupabaseClient` from `./server`
 * - Admin client:   use `getSupabaseAdminClient` below (service role, bypasses RLS)
 *
 * The anon-key singleton (`getSupabaseClient`) is kept for backward compatibility
 * with Supabase repository classes that run server-side outside a request context
 * (e.g., orchestrator, socket server). Prefer the SSR-aware clients in Next.js routes.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _adminClient: SupabaseClient | null = null;

/**
 * Get the Supabase client using the anon key.
 * This respects RLS policies based on the authenticated user.
 *
 * NOTE: This is a plain client without cookie-based auth.
 * For Next.js Server Components / Route Handlers, prefer `createServerSupabaseClient`.
 * For Client Components, prefer `createBrowserSupabaseClient`.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
      );
    }
    _client = createClient(url, key);
  }
  return _client;
}

/**
 * Get the Supabase admin client using the service role key.
 * This bypasses RLS — use only for server-side admin operations.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (!_adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing Supabase admin credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
      );
    }
    _adminClient = createClient(url, key);
  }
  return _adminClient;
}
