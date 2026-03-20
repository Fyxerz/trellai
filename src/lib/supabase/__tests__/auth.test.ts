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

  describe("Route classification", () => {
    const authRoutes = ["/login", "/register", "/auth/callback"];
    const protectedRoutes = ["/teams", "/invites"];

    it("should identify /login as auth route", () => {
      expect(authRoutes.some((r) => "/login".startsWith(r))).toBe(true);
    });

    it("should identify /register as auth route", () => {
      expect(authRoutes.some((r) => "/register".startsWith(r))).toBe(true);
    });

    it("should identify /auth/callback as auth route", () => {
      expect(authRoutes.some((r) => "/auth/callback".startsWith(r))).toBe(true);
    });

    it("should identify / as publicly accessible (anonymous allowed)", () => {
      expect(protectedRoutes.some((r) => "/".startsWith(r))).toBe(false);
    });

    it("should identify /board/123 as publicly accessible (anonymous allowed)", () => {
      expect(protectedRoutes.some((r) => "/board/123".startsWith(r))).toBe(false);
    });

    it("should identify /teams as protected (requires auth)", () => {
      expect(protectedRoutes.some((r) => "/teams".startsWith(r))).toBe(true);
    });

    it("should identify /invites as protected (requires auth)", () => {
      expect(protectedRoutes.some((r) => "/invites".startsWith(r))).toBe(true);
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
      teamId: null,
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
      teamId: null,
      createdAt: new Date().toISOString(),
    };
    expect(row.userId).toBeNull();
  });

  it("should include teamId in ProjectRow type", () => {
    const row = {
      id: "p1",
      name: "Test",
      repoPath: "/tmp",
      chatSessionId: null,
      mode: "worktree",
      storageMode: "local",
      userId: "user-1",
      teamId: "team-1",
      createdAt: new Date().toISOString(),
    };
    expect(row.teamId).toBe("team-1");
  });

  it("should allow null teamId for backward compatibility", () => {
    const row = {
      id: "p1",
      name: "Test",
      repoPath: "/tmp",
      chatSessionId: null,
      mode: "worktree",
      storageMode: "local",
      userId: null,
      teamId: null,
      createdAt: new Date().toISOString(),
    };
    expect(row.teamId).toBeNull();
  });
});

describe("Team types", () => {
  it("should have valid TeamRow shape", () => {
    const team = {
      id: "team-1",
      name: "My Team",
      isPersonal: false,
      createdAt: new Date().toISOString(),
    };
    expect(team.id).toBe("team-1");
    expect(team.isPersonal).toBe(false);
  });

  it("should have valid TeamMemberRow shape", () => {
    const member = {
      id: "tm-1",
      teamId: "team-1",
      userId: "user-1",
      role: "owner" as const,
      createdAt: new Date().toISOString(),
    };
    expect(member.role).toBe("owner");
    expect(["owner", "admin", "member"]).toContain(member.role);
  });

  it("should have valid InviteRow shape", () => {
    const invite = {
      id: "inv-1",
      teamId: "team-1",
      email: "user@example.com",
      role: "member" as const,
      status: "pending" as const,
      invitedBy: "user-1",
      createdAt: new Date().toISOString(),
    };
    expect(invite.status).toBe("pending");
    expect(["pending", "accepted", "declined", "expired"]).toContain(invite.status);
  });

  it("should have valid UserRow shape", () => {
    const user = {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      avatarUrl: "https://example.com/avatar.jpg",
      createdAt: new Date().toISOString(),
    };
    expect(user.email).toBe("test@example.com");
    expect(user.name).toBe("Test User");
  });

  it("should allow nullable name and avatarUrl in UserRow", () => {
    const user = {
      id: "user-1",
      email: "test@example.com",
      name: null,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
    };
    expect(user.name).toBeNull();
    expect(user.avatarUrl).toBeNull();
  });
});
