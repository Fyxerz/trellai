"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Whether the user is anonymous (not logged in) */
  isAnonymous: boolean;
  /** Whether Supabase is configured (auth is available) */
  isAuthConfigured: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  isAnonymous: true,
  isAuthConfigured: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  useEffect(() => {
    // If Supabase is not configured, immediately resolve as anonymous
    if (!isAuthConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function initAuth() {
      try {
        // Dynamic import to avoid crashes when Supabase env vars are missing
        const { createBrowserSupabaseClient } = await import("@/lib/supabase/browser");
        const supabase = createBrowserSupabaseClient();

        // Get the initial session
        const { data: { session: s } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(s);
          setUser(s?.user ?? null);
          setLoading(false);
        }

        // Listen for auth state changes (sign in, sign out, token refresh)
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, s) => {
          if (mounted) {
            setSession(s);
            setUser(s?.user ?? null);
            setLoading(false);
          }
        });

        return () => subscription.unsubscribe();
      } catch {
        // Supabase client creation failed — treat as anonymous
        if (mounted) {
          setLoading(false);
        }
        return undefined;
      }
    }

    const cleanupPromise = initAuth();
    return () => {
      mounted = false;
      cleanupPromise.then((fn) => fn?.());
    };
  }, [isAuthConfigured]);

  const isAnonymous = !loading && !user;

  return (
    <AuthContext.Provider value={{ user, session, loading, isAnonymous, isAuthConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
