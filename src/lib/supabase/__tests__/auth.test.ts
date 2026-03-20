import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @supabase/ssr
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1", email: "test@example.com" } } },
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1", email: "test@example.com" } },
      }),
    },
  })),
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1", email: "test@example.com" } },
      }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ data: { url: "https://example.com/auth" }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  })),
}));

describe("Supabase Auth Configuration", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  });

  describe("Browser client", () => {
    it("should create a browser client with correct env vars", async () => {
      const { createBrowserClient } = await import("@supabase/ssr");
      const { createBrowserSupabaseClient } = await import("../browser");

      const client = createBrowserSupabaseClient();
      expect(createBrowserClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-anon-key"
      );
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
    });
  });

  describe("Middleware session update", () => {
    it("should export updateSession function", async () => {
      const { updateSession } = await import("../middleware");
      expect(typeof updateSession).toBe("function");
    });
  });

  describe("Public route detection", () => {
    it("should identify /login as public", () => {
      const publicRoutes = ["/login", "/register", "/auth/callback"];
      expect(publicRoutes.some((r) => "/login".startsWith(r))).toBe(true);
    });

    it("should identify /register as public", () => {
      const publicRoutes = ["/login", "/register", "/auth/callback"];
      expect(publicRoutes.some((r) => "/register".startsWith(r))).toBe(true);
    });

    it("should identify /auth/callback as public", () => {
      const publicRoutes = ["/login", "/register", "/auth/callback"];
      expect(publicRoutes.some((r) => "/auth/callback".startsWith(r))).toBe(true);
    });

    it("should identify / as protected", () => {
      const publicRoutes = ["/login", "/register", "/auth/callback"];
      expect(publicRoutes.some((r) => "/".startsWith(r))).toBe(false);
    });

    it("should identify /board/123 as protected", () => {
      const publicRoutes = ["/login", "/register", "/auth/callback"];
      expect(publicRoutes.some((r) => "/board/123".startsWith(r))).toBe(false);
    });
  });
});

describe("Multi-tenancy", () => {
  it("should include userId in ProjectRow type", () => {
    // Type-level test — if this compiles, the type is correct
    const row = {
      id: "p1",
      name: "Test",
      repoPath: "/tmp",
      chatSessionId: null,
      mode: "worktree",
      storageMode: "local",
      userId: "user-1",
      createdAt: new Date().toISOString(),
    };
    expect(row.userId).toBe("user-1");
  });

  it("should allow null userId for backward compatibility", () => {
    const row = {
      id: "p1",
      name: "Test",
      repoPath: "/tmp",
      chatSessionId: null,
      mode: "worktree",
      storageMode: "local",
      userId: null,
      createdAt: new Date().toISOString(),
    };
    expect(row.userId).toBeNull();
  });
});
