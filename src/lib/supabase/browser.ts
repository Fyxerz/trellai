/**
 * Supabase browser client for Client Components.
 *
 * Creates a new client per call — `@supabase/ssr` deduplicates
 * internally via the cookie-based storage key.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
