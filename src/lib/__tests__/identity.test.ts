import { describe, it, expect, beforeEach, vi } from "vitest";
import { getUserIdentity, setUserName, getInitials } from "../identity";

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
});
