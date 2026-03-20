import { describe, it, expect, beforeEach, vi } from "vitest";
import { getUserIdentity, setUserName, getInitials, colorFromId, getAuthIdentity } from "../identity";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((_index: number) => null),
  };
})();

// Mock uuid
vi.mock("uuid", () => ({
  v4: () => "test-uuid-1234",
}));

describe("identity", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("window", {});
  });

  describe("getUserIdentity", () => {
    it("creates a new identity when none exists", () => {
      const identity = getUserIdentity();
      expect(identity.id).toBe("test-uuid-1234");
      expect(identity.name).toBeTruthy();
      expect(identity.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it("persists identity to localStorage", () => {
      getUserIdentity();
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "trellai:user-identity",
        expect.any(String)
      );
    });

    it("returns the same identity on subsequent calls", () => {
      const first = getUserIdentity();
      const second = getUserIdentity();
      expect(second.id).toBe(first.id);
      expect(second.name).toBe(first.name);
      expect(second.color).toBe(first.color);
    });

    it("recovers from corrupt localStorage data", () => {
      localStorageMock.setItem("trellai:user-identity", "not-json");
      const identity = getUserIdentity();
      expect(identity.id).toBe("test-uuid-1234");
      expect(identity.name).toBeTruthy();
    });

    it("recovers from incomplete stored data", () => {
      localStorageMock.setItem(
        "trellai:user-identity",
        JSON.stringify({ id: "abc" })
      );
      const identity = getUserIdentity();
      expect(identity.id).toBe("test-uuid-1234");
    });
  });

  describe("setUserName", () => {
    it("updates the display name", () => {
      const identity = getUserIdentity();
      const updated = setUserName("New Name");
      expect(updated.name).toBe("New Name");
      expect(updated.id).toBe(identity.id);
      expect(updated.color).toBe(identity.color);
    });

    it("persists the updated name", () => {
      getUserIdentity();
      setUserName("Updated");
      const stored = JSON.parse(
        localStorageMock.getItem("trellai:user-identity")!
      );
      expect(stored.name).toBe("Updated");
    });

    it("ignores empty names", () => {
      const original = getUserIdentity();
      const updated = setUserName("   ");
      expect(updated.name).toBe(original.name);
    });

    it("trims whitespace from names", () => {
      getUserIdentity();
      const updated = setUserName("  Trimmed Name  ");
      expect(updated.name).toBe("Trimmed Name");
    });
  });

  describe("getInitials", () => {
    it("returns two-letter initials from two words", () => {
      expect(getInitials("Swift Fox")).toBe("SF");
    });

    it("returns two-letter initials from multiple words", () => {
      expect(getInitials("John Doe Smith")).toBe("JD");
    });

    it("returns first two chars for single word", () => {
      expect(getInitials("Fox")).toBe("FO");
    });

    it("handles single character", () => {
      expect(getInitials("A")).toBe("A");
    });

    it("uppercases initials", () => {
      expect(getInitials("swift fox")).toBe("SF");
    });
  });

  describe("colorFromId", () => {
    it("returns a valid hex color", () => {
      expect(colorFromId("user-123")).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it("returns the same color for the same id", () => {
      expect(colorFromId("abc")).toBe(colorFromId("abc"));
    });

    it("returns different colors for different ids (usually)", () => {
      // Not guaranteed but very likely for distinct strings
      const colors = new Set([
        colorFromId("alice"),
        colorFromId("bob"),
        colorFromId("charlie"),
        colorFromId("dave"),
        colorFromId("eve"),
      ]);
      expect(colors.size).toBeGreaterThan(1);
    });
  });

  describe("getAuthIdentity", () => {
    it("uses full_name from user_metadata", () => {
      const identity = getAuthIdentity({
        id: "supabase-uid",
        email: "alice@example.com",
        user_metadata: { full_name: "Alice Smith", avatar_url: "https://example.com/avatar.jpg" },
      });
      expect(identity.id).toBe("supabase-uid");
      expect(identity.name).toBe("Alice Smith");
      expect(identity.avatarUrl).toBe("https://example.com/avatar.jpg");
      expect(identity.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it("falls back to email when no full_name", () => {
      const identity = getAuthIdentity({
        id: "uid-2",
        email: "bob@example.com",
        user_metadata: {},
      });
      expect(identity.name).toBe("bob@example.com");
      expect(identity.avatarUrl).toBeNull();
    });

    it("falls back to 'User' when no email or name", () => {
      const identity = getAuthIdentity({
        id: "uid-3",
        user_metadata: {},
      });
      expect(identity.name).toBe("User");
    });

    it("derives color deterministically from user id", () => {
      const a = getAuthIdentity({ id: "same-id", email: "a@b.com" });
      const b = getAuthIdentity({ id: "same-id", email: "different@b.com" });
      expect(a.color).toBe(b.color);
    });
  });
});
