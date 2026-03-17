import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// We'll import these after creating the module
import {
  checkExistingDocs,
  generateProjectDocs,
  type DocsCheckResult,
} from "../project-docs-generator";

describe("project-docs-generator", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "trellai-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("checkExistingDocs", () => {
    it("returns all false when .claude directory does not exist", () => {
      const result = checkExistingDocs(tempDir);
      expect(result).toEqual({
        claudeMd: false,
        planMd: false,
        projectMd: false,
      });
    });

    it("returns all false when .claude directory exists but is empty", () => {
      mkdirSync(join(tempDir, ".claude"), { recursive: true });
      const result = checkExistingDocs(tempDir);
      expect(result).toEqual({
        claudeMd: false,
        planMd: false,
        projectMd: false,
      });
    });

    it("detects existing claude.md", () => {
      mkdirSync(join(tempDir, ".claude"), { recursive: true });
      writeFileSync(join(tempDir, ".claude", "claude.md"), "# Existing");
      const result = checkExistingDocs(tempDir);
      expect(result.claudeMd).toBe(true);
      expect(result.planMd).toBe(false);
      expect(result.projectMd).toBe(false);
    });

    it("detects existing plan.md", () => {
      mkdirSync(join(tempDir, ".claude"), { recursive: true });
      writeFileSync(join(tempDir, ".claude", "plan.md"), "# Plan");
      const result = checkExistingDocs(tempDir);
      expect(result.planMd).toBe(true);
    });

    it("detects existing project.md", () => {
      mkdirSync(join(tempDir, ".claude"), { recursive: true });
      writeFileSync(join(tempDir, ".claude", "project.md"), "# Project");
      const result = checkExistingDocs(tempDir);
      expect(result.projectMd).toBe(true);
    });

    it("detects all three when all exist", () => {
      mkdirSync(join(tempDir, ".claude"), { recursive: true });
      writeFileSync(join(tempDir, ".claude", "claude.md"), "# Claude");
      writeFileSync(join(tempDir, ".claude", "plan.md"), "# Plan");
      writeFileSync(join(tempDir, ".claude", "project.md"), "# Project");
      const result = checkExistingDocs(tempDir);
      expect(result).toEqual({
        claudeMd: true,
        planMd: true,
        projectMd: true,
      });
    });
  });

  describe("generateProjectDocs", () => {
    it("creates .claude directory if it doesn't exist", async () => {
      const result = await generateProjectDocs(tempDir, "Test Project");
      expect(existsSync(join(tempDir, ".claude"))).toBe(true);
    });

    it("creates claude.md when missing", async () => {
      const result = await generateProjectDocs(tempDir, "Test Project");
      expect(result.created).toContain("claude.md");
      expect(existsSync(join(tempDir, ".claude", "claude.md"))).toBe(true);
    });

    it("creates plan.md when missing", async () => {
      const result = await generateProjectDocs(tempDir, "Test Project");
      expect(result.created).toContain("plan.md");
      expect(existsSync(join(tempDir, ".claude", "plan.md"))).toBe(true);
    });

    it("creates project.md when missing", async () => {
      const result = await generateProjectDocs(tempDir, "Test Project");
      expect(result.created).toContain("project.md");
      expect(existsSync(join(tempDir, ".claude", "project.md"))).toBe(true);
    });

    it("does not overwrite existing claude.md", async () => {
      mkdirSync(join(tempDir, ".claude"), { recursive: true });
      writeFileSync(join(tempDir, ".claude", "claude.md"), "# Custom content");
      const result = await generateProjectDocs(tempDir, "Test Project");
      expect(result.skipped).toContain("claude.md");
      expect(readFileSync(join(tempDir, ".claude", "claude.md"), "utf-8")).toBe(
        "# Custom content"
      );
    });

    it("does not overwrite existing plan.md", async () => {
      mkdirSync(join(tempDir, ".claude"), { recursive: true });
      writeFileSync(join(tempDir, ".claude", "plan.md"), "# My plan");
      const result = await generateProjectDocs(tempDir, "Test Project");
      expect(result.skipped).toContain("plan.md");
      expect(readFileSync(join(tempDir, ".claude", "plan.md"), "utf-8")).toBe(
        "# My plan"
      );
    });

    it("does not overwrite existing project.md", async () => {
      mkdirSync(join(tempDir, ".claude"), { recursive: true });
      writeFileSync(join(tempDir, ".claude", "project.md"), "# My project");
      const result = await generateProjectDocs(tempDir, "Test Project");
      expect(result.skipped).toContain("project.md");
    });

    it("returns early when all files exist", async () => {
      mkdirSync(join(tempDir, ".claude"), { recursive: true });
      writeFileSync(join(tempDir, ".claude", "claude.md"), "# Claude");
      writeFileSync(join(tempDir, ".claude", "plan.md"), "# Plan");
      writeFileSync(join(tempDir, ".claude", "project.md"), "# Project");
      const result = await generateProjectDocs(tempDir, "Test Project");
      expect(result.created).toHaveLength(0);
      expect(result.skipped).toHaveLength(3);
    });

    it("claude.md references plan.md and project.md", async () => {
      const result = await generateProjectDocs(tempDir, "Test Project");
      const content = readFileSync(
        join(tempDir, ".claude", "claude.md"),
        "utf-8"
      );
      expect(content).toContain("plan.md");
      expect(content).toContain("project.md");
    });

    it("claude.md mentions TDD", async () => {
      const result = await generateProjectDocs(tempDir, "Test Project");
      const content = readFileSync(
        join(tempDir, ".claude", "claude.md"),
        "utf-8"
      );
      expect(content.toLowerCase()).toContain("tdd");
    });

    it("project.md contains the project name", async () => {
      const result = await generateProjectDocs(tempDir, "Test Project");
      const content = readFileSync(
        join(tempDir, ".claude", "project.md"),
        "utf-8"
      );
      expect(content).toContain("Test Project");
    });

    it("handles repo with package.json (detects tech stack)", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "my-app",
          dependencies: { react: "^19.0.0", next: "^16.0.0" },
        })
      );
      const result = await generateProjectDocs(tempDir, "My App");
      const content = readFileSync(
        join(tempDir, ".claude", "project.md"),
        "utf-8"
      );
      // Should detect and mention the tech stack
      expect(content.toLowerCase()).toMatch(/react|next/);
    });

    it("handles empty repo gracefully", async () => {
      const result = await generateProjectDocs(tempDir, "Empty Project");
      expect(result.created.length).toBeGreaterThan(0);
      // Should still produce valid markdown files
      const claudeContent = readFileSync(
        join(tempDir, ".claude", "claude.md"),
        "utf-8"
      );
      expect(claudeContent.startsWith("#")).toBe(true);
    });

    it("handles repo with Cargo.toml (Rust project)", async () => {
      writeFileSync(
        join(tempDir, "Cargo.toml"),
        '[package]\nname = "my-rust-app"\nversion = "0.1.0"'
      );
      mkdirSync(join(tempDir, "src"));
      writeFileSync(join(tempDir, "src", "main.rs"), 'fn main() { println!("hello"); }');
      const result = await generateProjectDocs(tempDir, "Rust App");
      const content = readFileSync(
        join(tempDir, ".claude", "project.md"),
        "utf-8"
      );
      expect(content.toLowerCase()).toMatch(/rust|cargo/);
    });

    it("handles repo with pyproject.toml (Python project)", async () => {
      writeFileSync(
        join(tempDir, "pyproject.toml"),
        '[project]\nname = "my-python-app"\nversion = "0.1.0"'
      );
      const result = await generateProjectDocs(tempDir, "Python App");
      const content = readFileSync(
        join(tempDir, ".claude", "project.md"),
        "utf-8"
      );
      expect(content.toLowerCase()).toMatch(/python/);
    });

    it("detects directory structure", async () => {
      mkdirSync(join(tempDir, "src", "components"), { recursive: true });
      mkdirSync(join(tempDir, "src", "lib"), { recursive: true });
      mkdirSync(join(tempDir, "tests"), { recursive: true });
      writeFileSync(join(tempDir, "src", "index.ts"), "export {};");
      const result = await generateProjectDocs(tempDir, "Structured Project");
      const content = readFileSync(
        join(tempDir, ".claude", "project.md"),
        "utf-8"
      );
      expect(content).toMatch(/src/);
    });
  });
});
