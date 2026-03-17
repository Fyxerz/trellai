import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from "fs";
import { join, basename } from "path";

export interface DocsCheckResult {
  claudeMd: boolean;
  planMd: boolean;
  projectMd: boolean;
}

export interface GenerationResult {
  created: string[];
  skipped: string[];
}

interface RepoAnalysis {
  name: string;
  stack: string[];
  language: string;
  packageManager: string | null;
  directories: string[];
  hasReadme: boolean;
  readmeContent: string | null;
  configFiles: string[];
  description: string | null;
}

/**
 * Check which of the three docs files already exist in {repoPath}/.claude/
 */
export function checkExistingDocs(repoPath: string): DocsCheckResult {
  const claudeDir = join(repoPath, ".claude");
  return {
    claudeMd: existsSync(join(claudeDir, "claude.md")),
    planMd: existsSync(join(claudeDir, "plan.md")),
    projectMd: existsSync(join(claudeDir, "project.md")),
  };
}

/**
 * Analyze a repository to detect tech stack, structure, etc.
 */
function analyzeRepo(repoPath: string): RepoAnalysis {
  const analysis: RepoAnalysis = {
    name: basename(repoPath),
    stack: [],
    language: "Unknown",
    packageManager: null,
    directories: [],
    hasReadme: false,
    readmeContent: null,
    configFiles: [],
    description: null,
  };

  // Scan top-level files
  let topLevelEntries: string[] = [];
  try {
    topLevelEntries = readdirSync(repoPath);
  } catch {
    return analysis;
  }

  // Detect config files
  const configPatterns = [
    "package.json",
    "Cargo.toml",
    "pyproject.toml",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "Gemfile",
    "composer.json",
    "tsconfig.json",
    "next.config.ts",
    "next.config.js",
    "vite.config.ts",
    "vite.config.js",
    "webpack.config.js",
    "tailwind.config.ts",
    "tailwind.config.js",
    "drizzle.config.ts",
    ".eslintrc.js",
    "eslint.config.js",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
  ];

  for (const entry of topLevelEntries) {
    if (configPatterns.includes(entry)) {
      analysis.configFiles.push(entry);
    }
  }

  // Detect directories (top-level only)
  for (const entry of topLevelEntries) {
    if (entry.startsWith(".")) continue;
    try {
      const fullPath = join(repoPath, entry);
      if (statSync(fullPath).isDirectory()) {
        analysis.directories.push(entry);
      }
    } catch {
      // skip
    }
  }

  // Read README if available
  const readmeNames = ["README.md", "readme.md", "README", "Readme.md"];
  for (const name of readmeNames) {
    if (topLevelEntries.includes(name)) {
      analysis.hasReadme = true;
      try {
        analysis.readmeContent = readFileSync(join(repoPath, name), "utf-8").slice(0, 2000);
      } catch {
        // skip
      }
      break;
    }
  }

  // Detect Node.js / JavaScript project
  if (topLevelEntries.includes("package.json")) {
    try {
      const pkg = JSON.parse(
        readFileSync(join(repoPath, "package.json"), "utf-8")
      );
      analysis.language = "JavaScript/TypeScript";
      analysis.description = pkg.description || null;

      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };

      if (allDeps["next"]) analysis.stack.push("Next.js");
      if (allDeps["react"]) analysis.stack.push("React");
      if (allDeps["vue"]) analysis.stack.push("Vue");
      if (allDeps["svelte"]) analysis.stack.push("Svelte");
      if (allDeps["express"]) analysis.stack.push("Express");
      if (allDeps["fastify"]) analysis.stack.push("Fastify");
      if (allDeps["tailwindcss"]) analysis.stack.push("Tailwind CSS");
      if (allDeps["drizzle-orm"]) analysis.stack.push("Drizzle ORM");
      if (allDeps["prisma"] || allDeps["@prisma/client"])
        analysis.stack.push("Prisma");
      if (allDeps["socket.io"]) analysis.stack.push("Socket.IO");
      if (allDeps["typescript"]) analysis.stack.push("TypeScript");
      if (allDeps["vitest"]) analysis.stack.push("Vitest");
      if (allDeps["jest"]) analysis.stack.push("Jest");

      // Detect package manager
      if (topLevelEntries.includes("pnpm-lock.yaml"))
        analysis.packageManager = "pnpm";
      else if (topLevelEntries.includes("yarn.lock"))
        analysis.packageManager = "yarn";
      else if (topLevelEntries.includes("bun.lockb"))
        analysis.packageManager = "bun";
      else if (topLevelEntries.includes("package-lock.json"))
        analysis.packageManager = "npm";
    } catch {
      // invalid package.json
    }
  }

  // Detect Rust project
  if (topLevelEntries.includes("Cargo.toml")) {
    analysis.language = "Rust";
    analysis.stack.push("Cargo");
    try {
      const cargo = readFileSync(join(repoPath, "Cargo.toml"), "utf-8");
      if (cargo.includes("tokio")) analysis.stack.push("Tokio");
      if (cargo.includes("actix")) analysis.stack.push("Actix");
      if (cargo.includes("axum")) analysis.stack.push("Axum");
    } catch {
      // skip
    }
  }

  // Detect Python project
  if (
    topLevelEntries.includes("pyproject.toml") ||
    topLevelEntries.includes("setup.py") ||
    topLevelEntries.includes("requirements.txt")
  ) {
    analysis.language = "Python";
    try {
      if (topLevelEntries.includes("pyproject.toml")) {
        const pyproject = readFileSync(
          join(repoPath, "pyproject.toml"),
          "utf-8"
        );
        if (pyproject.includes("django")) analysis.stack.push("Django");
        if (pyproject.includes("flask")) analysis.stack.push("Flask");
        if (pyproject.includes("fastapi")) analysis.stack.push("FastAPI");
      }
    } catch {
      // skip
    }
  }

  // Detect Go project
  if (topLevelEntries.includes("go.mod")) {
    analysis.language = "Go";
    analysis.stack.push("Go Modules");
  }

  return analysis;
}

/**
 * Generate the content for claude.md
 */
function generateClaudeMdContent(
  projectName: string,
  analysis: RepoAnalysis
): string {
  const lines: string[] = [];
  lines.push(`# ${projectName}`);
  lines.push("");
  lines.push("## Design Decisions");
  lines.push("");
  if (analysis.stack.length > 0) {
    lines.push(
      `This project uses ${analysis.stack.join(", ")} as its core technology stack.`
    );
  } else {
    lines.push(
      "Document design decisions here as they are made during development."
    );
  }
  lines.push("");
  lines.push("## Coding Principles");
  lines.push("");
  lines.push(
    "- **TDD is primordial** — Write tests before implementation. Every feature should start with a failing test."
  );
  lines.push(
    "- Write clean, readable code with meaningful names and clear intent."
  );
  lines.push("- Prefer small, focused functions and modules.");
  lines.push("- Keep dependencies minimal and well-justified.");
  lines.push("");
  lines.push("## Documentation");
  lines.push("");
  lines.push(
    "- See [plan.md](./plan.md) for the project roadmap, completed work, and upcoming tasks."
  );
  lines.push(
    "- See [project.md](./project.md) for architecture, tech stack, and project structure."
  );
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate the content for project.md
 */
function generateProjectMdContent(
  projectName: string,
  analysis: RepoAnalysis
): string {
  const lines: string[] = [];
  lines.push(`# ${projectName}`);
  lines.push("");
  lines.push("## Overview");
  lines.push("");
  if (analysis.description) {
    lines.push(analysis.description);
  } else if (analysis.hasReadme && analysis.readmeContent) {
    // Extract first paragraph from README
    const firstParagraph = analysis.readmeContent
      .split("\n\n")
      .find((p) => p.trim() && !p.startsWith("#"));
    lines.push(firstParagraph?.trim() || `${projectName} project.`);
  } else {
    lines.push(`${projectName} project.`);
  }
  lines.push("");
  lines.push("## Tech Stack");
  lines.push("");
  if (analysis.stack.length > 0) {
    lines.push(`- **Language**: ${analysis.language}`);
    for (const tech of analysis.stack) {
      lines.push(`- ${tech}`);
    }
    if (analysis.packageManager) {
      lines.push(`- **Package Manager**: ${analysis.packageManager}`);
    }
  } else {
    lines.push(`- **Language**: ${analysis.language}`);
    lines.push("- Add technologies as they are adopted.");
  }
  lines.push("");
  lines.push("## Project Structure");
  lines.push("");
  if (analysis.directories.length > 0) {
    lines.push("```");
    lines.push(`${basename(analysis.name)}/`);
    for (const dir of analysis.directories.sort()) {
      lines.push(`  ${dir}/`);
    }
    if (analysis.configFiles.length > 0) {
      for (const cf of analysis.configFiles.sort()) {
        lines.push(`  ${cf}`);
      }
    }
    lines.push("```");
  } else {
    lines.push("Document the project structure as it evolves.");
  }
  lines.push("");
  lines.push("## Architecture");
  lines.push("");
  lines.push(
    "Document the architecture and how components fit together as the project grows."
  );
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate the content for plan.md
 */
function generatePlanMdContent(
  projectName: string,
  analysis: RepoAnalysis
): string {
  const lines: string[] = [];
  lines.push(`# ${projectName} — Plan`);
  lines.push("");
  lines.push("## Completed");
  lines.push("");
  if (analysis.configFiles.length > 0 || analysis.directories.length > 0) {
    lines.push("- Initial project setup");
    if (analysis.stack.length > 0) {
      lines.push(`- ${analysis.stack.join(", ")} configured`);
    }
  } else {
    lines.push("- (nothing yet)");
  }
  lines.push("");
  lines.push("## In Progress");
  lines.push("");
  lines.push("- (track current work here)");
  lines.push("");
  lines.push("## Planned");
  lines.push("");
  lines.push("- (add upcoming tasks here)");
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate project documentation files in {repoPath}/.claude/
 * Skips files that already exist. Creates .claude/ directory if needed.
 */
export async function generateProjectDocs(
  repoPath: string,
  projectName: string
): Promise<GenerationResult> {
  const existing = checkExistingDocs(repoPath);
  const created: string[] = [];
  const skipped: string[] = [];

  // Track skipped files
  if (existing.claudeMd) skipped.push("claude.md");
  if (existing.planMd) skipped.push("plan.md");
  if (existing.projectMd) skipped.push("project.md");

  // Early return if all exist
  if (existing.claudeMd && existing.planMd && existing.projectMd) {
    return { created, skipped };
  }

  // Ensure .claude directory exists
  const claudeDir = join(repoPath, ".claude");
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }

  // Analyze the repository
  const analysis = analyzeRepo(repoPath);

  // Generate missing files
  if (!existing.claudeMd) {
    const content = generateClaudeMdContent(projectName, analysis);
    writeFileSync(join(claudeDir, "claude.md"), content, "utf-8");
    created.push("claude.md");
  }

  if (!existing.projectMd) {
    const content = generateProjectMdContent(projectName, analysis);
    writeFileSync(join(claudeDir, "project.md"), content, "utf-8");
    created.push("project.md");
  }

  if (!existing.planMd) {
    const content = generatePlanMdContent(projectName, analysis);
    writeFileSync(join(claudeDir, "plan.md"), content, "utf-8");
    created.push("plan.md");
  }

  return { created, skipped };
}
