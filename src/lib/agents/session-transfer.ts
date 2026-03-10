import { existsSync, mkdirSync, cpSync, copyFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

/**
 * Encode a filesystem path the same way the Claude SDK does for
 * ~/.claude/projects/<encoded-cwd>/.  Replaces every `/` with `-`.
 */
function encodeProjectPath(fsPath: string): string {
  return fsPath.replace(/\//g, "-");
}

/**
 * Copy a session's `.jsonl` file (and companion directory if it exists) from
 * one project directory to another so the SDK can find it when resuming
 * with a different cwd.
 *
 * Returns `true` if the copy succeeded, `false` if the source wasn't found.
 */
export function copySessionToProject(
  sessionId: string,
  sourceCwd: string,
  targetCwd: string
): boolean {
  const claudeProjects = join(homedir(), ".claude", "projects");
  const sourceDir = join(claudeProjects, encodeProjectPath(sourceCwd));
  const targetDir = join(claudeProjects, encodeProjectPath(targetCwd));

  const jsonlName = `${sessionId}.jsonl`;
  const sourceJsonl = join(sourceDir, jsonlName);

  if (!existsSync(sourceJsonl)) {
    console.log(
      `[session-transfer] Source session file not found: ${sourceJsonl}`
    );
    return false;
  }

  // Ensure target project directory exists
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Copy the .jsonl transcript
  copyFileSync(sourceJsonl, join(targetDir, jsonlName));
  console.log(
    `[session-transfer] Copied session ${sessionId} from ${sourceDir} → ${targetDir}`
  );

  // Copy companion directory if it exists (contains tool results, etc.)
  const sourceCompanion = join(sourceDir, sessionId);
  if (existsSync(sourceCompanion)) {
    cpSync(sourceCompanion, join(targetDir, sessionId), { recursive: true });
    console.log(`[session-transfer] Copied companion directory for ${sessionId}`);
  }

  return true;
}
