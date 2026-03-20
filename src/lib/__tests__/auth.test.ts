import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock createServerSupabaseClient before importing auth module
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
      },
    })
  ),
}));

// Mock the repositories
const mockFindProjectById = vi.fn();
const mockFindCardById = vi.fn();
const mockFindByTeamAndUser = vi.fn();
const mockFindByProjectAndUser = vi.fn();

vi.mock("@/lib/db/repositories", () => ({
  getLocalRepositories: () => ({
    projects: { findById: mockFindProjectById },
    cards: { findById: mockFindCardById },
  }),
  getRepositories: () => ({
    teamMembers: { findByTeamAndUser: mockFindByTeamAndUser },
    boardCollaborators: { findByProjectAndUser: mockFindByProjectAndUser },
  }),
}));

describe("Auth helpers", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockGetUser.mockReset();
    mockFindProjectById.mockReset();
    mockFindCardById.mockReset();
    mockFindByTeamAndUser.mockReset();
    mockFindByProjectAndUser.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getAuthUser", () => {
    it("should return dev user when DEV_BYPASS_AUTH is true", async () => {
      vi.stubEnv("DEV_BYPASS_AUTH", "true");
      // Re-import to pick up the env change
      const { getAuthUser } = await import("@/lib/auth");
      const user = await getAuthUser();
      expect(user).toEqual({ id: "dev-user", email: "dev@localhost" });
    });

    it("should return authenticated user from Supabase", async () => {
      vi.stubEnv("DEV_BYPASS_AUTH", "false");
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      });

      const { getAuthUser } = await import("@/lib/auth");
      const user = await getAuthUser();
      expect(user).toEqual({ id: "user-123", email: "test@example.com" });
    });

    it("should return null when Supabase returns no user", async () => {
      vi.stubEnv("DEV_BYPASS_AUTH", "false");
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { getAuthUser } = await import("@/lib/auth");
      const user = await getAuthUser();
      expect(user).toBeNull();
    });

    it("should return null when Supabase returns an error", async () => {
      vi.stubEnv("DEV_BYPASS_AUTH", "false");
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Invalid token"),
      });

      const { getAuthUser } = await import("@/lib/auth");
      const user = await getAuthUser();
      expect(user).toBeNull();
    });
  });

  describe("unauthorized", () => {
    it("should return 401 response", async () => {
      const { unauthorized } = await import("@/lib/auth");
      const response = unauthorized();
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });
  });

  describe("forbidden", () => {
    it("should return 403 response", async () => {
      const { forbidden } = await import("@/lib/auth");
      const response = forbidden();
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("Forbidden");
    });
  });

  describe("assertProjectAccess", () => {
    it("should return true for project owner", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "user-123",
        teamId: null,
      });

      const { assertProjectAccess } = await import("@/lib/auth");
      const result = await assertProjectAccess("proj-1", "user-123");
      expect(result).toBe(true);
    });

    it("should return true for legacy project (null userId)", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: null,
        teamId: null,
      });

      const { assertProjectAccess } = await import("@/lib/auth");
      const result = await assertProjectAccess("proj-1", "user-123");
      expect(result).toBe(true);
    });

    it("should return false for non-existent project", async () => {
      mockFindProjectById.mockResolvedValue(undefined);

      const { assertProjectAccess } = await import("@/lib/auth");
      const result = await assertProjectAccess("proj-999", "user-123");
      expect(result).toBe(false);
    });

    it("should return false when user is not owner and no team", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "other-user",
        teamId: null,
      });

      const { assertProjectAccess } = await import("@/lib/auth");
      const result = await assertProjectAccess("proj-1", "user-123");
      expect(result).toBe(false);
    });

    it("should return true for team member", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "other-user",
        teamId: "team-1",
      });
      mockFindByTeamAndUser.mockResolvedValue({
        id: "tm-1",
        teamId: "team-1",
        userId: "user-123",
        role: "member",
      });

      const { assertProjectAccess } = await import("@/lib/auth");
      const result = await assertProjectAccess("proj-1", "user-123");
      expect(result).toBe(true);
    });

    it("should return false for non-team-member", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "other-user",
        teamId: "team-1",
      });
      mockFindByTeamAndUser.mockResolvedValue(undefined);

      const { assertProjectAccess } = await import("@/lib/auth");
      const result = await assertProjectAccess("proj-1", "user-123");
      expect(result).toBe(false);
    });
  });

  describe("assertCardAccess", () => {
    it("should return true when user has access to card's project", async () => {
      mockFindCardById.mockResolvedValue({
        id: "card-1",
        projectId: "proj-1",
      });
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "user-123",
        teamId: null,
      });

      const { assertCardAccess } = await import("@/lib/auth");
      const result = await assertCardAccess("card-1", "user-123");
      expect(result).toBe(true);
    });

    it("should return false for non-existent card", async () => {
      mockFindCardById.mockResolvedValue(undefined);

      const { assertCardAccess } = await import("@/lib/auth");
      const result = await assertCardAccess("card-999", "user-123");
      expect(result).toBe(false);
    });

    it("should return false when user lacks access to card's project", async () => {
      mockFindCardById.mockResolvedValue({
        id: "card-1",
        projectId: "proj-1",
      });
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "other-user",
        teamId: null,
      });

      const { assertCardAccess } = await import("@/lib/auth");
      const result = await assertCardAccess("card-1", "user-123");
      expect(result).toBe(false);
    });
  });

  describe("getOptionalUser", () => {
    it("should be the same function as getAuthUser", async () => {
      const { getOptionalUser, getAuthUser } = await import("@/lib/auth");
      expect(getOptionalUser).toBe(getAuthUser);
    });
  });

  describe("assertProjectAccessForUser", () => {
    it("should allow anonymous access to null-userId projects", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: null,
        teamId: null,
      });

      const { assertProjectAccessForUser } = await import("@/lib/auth");
      const result = await assertProjectAccessForUser("proj-1", null);
      expect(result).toBe(true);
    });

    it("should deny anonymous access to owned projects", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "user-123",
        teamId: null,
      });

      const { assertProjectAccessForUser } = await import("@/lib/auth");
      const result = await assertProjectAccessForUser("proj-1", null);
      expect(result).toBe(false);
    });

    it("should return false for non-existent project with anonymous user", async () => {
      mockFindProjectById.mockResolvedValue(undefined);

      const { assertProjectAccessForUser } = await import("@/lib/auth");
      const result = await assertProjectAccessForUser("proj-999", null);
      expect(result).toBe(false);
    });

    it("should delegate to assertProjectAccess for authenticated users", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "user-123",
        teamId: null,
      });

      const { assertProjectAccessForUser } = await import("@/lib/auth");
      const result = await assertProjectAccessForUser("proj-1", { id: "user-123", email: "test@example.com" });
      expect(result).toBe(true);
    });

    it("should deny authenticated user access to other user's project", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "other-user",
        teamId: null,
      });

      const { assertProjectAccessForUser } = await import("@/lib/auth");
      const result = await assertProjectAccessForUser("proj-1", { id: "user-123", email: "test@example.com" });
      expect(result).toBe(false);
    });
  });

  describe("assertCardAccessForUser", () => {
    it("should allow anonymous access to card in null-userId project", async () => {
      mockFindCardById.mockResolvedValue({
        id: "card-1",
        projectId: "proj-1",
      });
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: null,
        teamId: null,
      });

      const { assertCardAccessForUser } = await import("@/lib/auth");
      const result = await assertCardAccessForUser("card-1", null);
      expect(result).toBe(true);
    });

    it("should deny anonymous access to card in owned project", async () => {
      mockFindCardById.mockResolvedValue({
        id: "card-1",
        projectId: "proj-1",
      });
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "user-123",
        teamId: null,
      });

      const { assertCardAccessForUser } = await import("@/lib/auth");
      const result = await assertCardAccessForUser("card-1", null);
      expect(result).toBe(false);
    });

    it("should return false for non-existent card with anonymous user", async () => {
      mockFindCardById.mockResolvedValue(undefined);

      const { assertCardAccessForUser } = await import("@/lib/auth");
      const result = await assertCardAccessForUser("card-999", null);
      expect(result).toBe(false);
    });
  });

  describe("assertProjectAccess - board collaborator", () => {
    it("should return true for board collaborator", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "other-user",
        teamId: null,
      });
      mockFindByProjectAndUser.mockResolvedValue({
        id: "bc-1",
        projectId: "proj-1",
        userId: "user-123",
        role: "editor",
      });

      const { assertProjectAccess } = await import("@/lib/auth");
      const result = await assertProjectAccess("proj-1", "user-123");
      expect(result).toBe(true);
    });

    it("should return false when not a board collaborator and not team member", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "other-user",
        teamId: null,
      });
      mockFindByProjectAndUser.mockResolvedValue(undefined);

      const { assertProjectAccess } = await import("@/lib/auth");
      const result = await assertProjectAccess("proj-1", "user-123");
      expect(result).toBe(false);
    });
  });

  describe("getProjectRole", () => {
    it("should return admin for project owner", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "user-123",
        teamId: null,
      });

      const { getProjectRole } = await import("@/lib/auth");
      const role = await getProjectRole("proj-1", "user-123");
      expect(role).toBe("admin");
    });

    it("should return admin for legacy project (null userId)", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: null,
        teamId: null,
      });

      const { getProjectRole } = await import("@/lib/auth");
      const role = await getProjectRole("proj-1", "user-123");
      expect(role).toBe("admin");
    });

    it("should return null for non-existent project", async () => {
      mockFindProjectById.mockResolvedValue(undefined);

      const { getProjectRole } = await import("@/lib/auth");
      const role = await getProjectRole("proj-999", "user-123");
      expect(role).toBeNull();
    });

    it("should return editor for team member role", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "other-user",
        teamId: "team-1",
      });
      mockFindByTeamAndUser.mockResolvedValue({
        id: "tm-1",
        teamId: "team-1",
        userId: "user-123",
        role: "member",
      });
      mockFindByProjectAndUser.mockResolvedValue(undefined);

      const { getProjectRole } = await import("@/lib/auth");
      const role = await getProjectRole("proj-1", "user-123");
      expect(role).toBe("editor");
    });

    it("should return admin for team admin", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "other-user",
        teamId: "team-1",
      });
      mockFindByTeamAndUser.mockResolvedValue({
        id: "tm-1",
        teamId: "team-1",
        userId: "user-123",
        role: "admin",
      });
      mockFindByProjectAndUser.mockResolvedValue(undefined);

      const { getProjectRole } = await import("@/lib/auth");
      const role = await getProjectRole("proj-1", "user-123");
      expect(role).toBe("admin");
    });

    it("should return board collaborator role when no team access", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "other-user",
        teamId: null,
      });
      mockFindByProjectAndUser.mockResolvedValue({
        id: "bc-1",
        projectId: "proj-1",
        userId: "user-123",
        role: "viewer",
      });

      const { getProjectRole } = await import("@/lib/auth");
      const role = await getProjectRole("proj-1", "user-123");
      expect(role).toBe("viewer");
    });

    it("should return highest privilege when both team and board access exist", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "other-user",
        teamId: "team-1",
      });
      // Team member = editor equivalent
      mockFindByTeamAndUser.mockResolvedValue({
        id: "tm-1",
        teamId: "team-1",
        userId: "user-123",
        role: "member",
      });
      // Board admin = higher privilege
      mockFindByProjectAndUser.mockResolvedValue({
        id: "bc-1",
        projectId: "proj-1",
        userId: "user-123",
        role: "admin",
      });

      const { getProjectRole } = await import("@/lib/auth");
      const role = await getProjectRole("proj-1", "user-123");
      expect(role).toBe("admin");
    });

    it("should return null when no access at all", async () => {
      mockFindProjectById.mockResolvedValue({
        id: "proj-1",
        userId: "other-user",
        teamId: null,
      });
      mockFindByProjectAndUser.mockResolvedValue(undefined);

      const { getProjectRole } = await import("@/lib/auth");
      const role = await getProjectRole("proj-1", "user-123");
      expect(role).toBeNull();
    });
  });
});
