import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import fs from "fs";
import path from "path";

const repos = getLocalRepositories();

// Directories and patterns to always exclude
const EXCLUDED = new Set([
  ".git",
  "node_modules",
  ".next",
  ".turbo",
  "__pycache__",
  ".DS_Store",
  "Thumbs.db",
]);

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB limit for reading files

interface FileEntry {
  name: string;
  path: string; // relative to repo root
  type: "file" | "directory";
  size?: number;
}

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const textExts = new Set([
    ".txt", ".md", ".json", ".js", ".jsx", ".ts", ".tsx",
    ".css", ".scss", ".less", ".html", ".htm", ".xml", ".svg",
    ".yml", ".yaml", ".toml", ".ini", ".cfg", ".conf",
    ".env", ".env.local", ".env.development", ".env.production",
    ".gitignore", ".gitattributes", ".editorconfig",
    ".eslintrc", ".prettierrc", ".babelrc",
    ".sh", ".bash", ".zsh", ".fish",
    ".py", ".rb", ".go", ".rs", ".java", ".kt", ".swift",
    ".c", ".cpp", ".h", ".hpp", ".cs",
    ".sql", ".graphql", ".gql",
    ".dockerfile", ".dockerignore",
    ".lock", ".log",
    "",  // files without extension (Makefile, Dockerfile, etc.)
  ]);
  return textExts.has(ext);
}

function safePath(repoPath: string, relativePath: string): string | null {
  const resolved = path.resolve(repoPath, relativePath);
  // Prevent path traversal
  if (!resolved.startsWith(path.resolve(repoPath))) return null;
  return resolved;
}

/**
 * GET /api/projects/[id]/repo-files
 * Query params:
 *   ?path= (optional) — relative directory path within the repo
 *   ?file= (optional) — relative file path to read content
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await repos.projects.findById(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const repoPath = project.repoPath;
  if (!repoPath || !fs.existsSync(repoPath)) {
    return NextResponse.json({ error: "Repository path not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const filePath = url.searchParams.get("file");
  const dirPath = url.searchParams.get("path") || "";

  // Read file content
  if (filePath) {
    const absPath = safePath(repoPath, filePath);
    if (!absPath) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const stat = fs.statSync(absPath);
    if (stat.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large (>1MB)" },
        { status: 413 }
      );
    }

    if (!isTextFile(absPath)) {
      return NextResponse.json(
        { error: "Binary files are not supported" },
        { status: 415 }
      );
    }

    const content = fs.readFileSync(absPath, "utf-8");
    return NextResponse.json({
      path: filePath,
      content,
      size: stat.size,
    });
  }

  // List directory
  const absDirPath = safePath(repoPath, dirPath);
  if (!absDirPath) {
    return NextResponse.json({ error: "Invalid directory path" }, { status: 400 });
  }
  if (!fs.existsSync(absDirPath) || !fs.statSync(absDirPath).isDirectory()) {
    return NextResponse.json({ error: "Directory not found" }, { status: 404 });
  }

  try {
    const entries = fs.readdirSync(absDirPath, { withFileTypes: true });
    const files: FileEntry[] = [];

    for (const entry of entries) {
      if (EXCLUDED.has(entry.name)) continue;
      // Skip hidden files/dirs (but allow .env* and common dotfiles)
      if (
        entry.name.startsWith(".") &&
        !entry.name.startsWith(".env") &&
        !["gitignore", "gitattributes", "editorconfig", "eslintrc", "prettierrc", "babelrc", "dockerignore"]
          .some((n) => entry.name === `.${n}`)
      ) {
        continue;
      }

      const relativePath = dirPath ? `${dirPath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        files.push({ name: entry.name, path: relativePath, type: "directory" });
      } else if (entry.isFile()) {
        const stat = fs.statSync(path.join(absDirPath, entry.name));
        files.push({
          name: entry.name,
          path: relativePath,
          type: "file",
          size: stat.size,
        });
      }
    }

    // Sort: directories first, then alphabetical
    files.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ path: dirPath || ".", entries: files });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to read directory: ${err}` },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[id]/repo-files
 * Body: { file: string, content: string }
 * Saves file to disk and auto-commits
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await repos.projects.findById(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const repoPath = project.repoPath;
  if (!repoPath || !fs.existsSync(repoPath)) {
    return NextResponse.json({ error: "Repository path not found" }, { status: 404 });
  }

  const body = await req.json();
  const { file, content } = body as { file?: string; content?: string };

  if (!file || content === undefined) {
    return NextResponse.json(
      { error: "Missing 'file' or 'content' in body" },
      { status: 400 }
    );
  }

  const absPath = safePath(repoPath, file);
  if (!absPath) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }

  try {
    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, "utf-8");

    // Auto-commit
    const { execSync } = await import("child_process");
    try {
      execSync(`git add "${file}"`, { cwd: repoPath, encoding: "utf-8" });
      execSync(
        `git commit -m "Updated ${file} via Trellai editor"`,
        { cwd: repoPath, encoding: "utf-8" }
      );
    } catch {
      // Commit may fail if there are no changes (identical content) — that's OK
    }

    return NextResponse.json({ success: true, path: file });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to save file: ${err}` },
      { status: 500 }
    );
  }
}
