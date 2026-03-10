import { execSync } from "child_process";

export class QueueManager {
  commitChanges(
    repoPath: string,
    cardTitle: string,
    cardId: string
  ): { sha: string } {
    execSync("git add -A", { cwd: repoPath, stdio: "pipe" });

    // Check if there's anything to commit
    const status = execSync("git status --porcelain", {
      cwd: repoPath,
      encoding: "utf-8",
    }).trim();

    if (!status) {
      // Nothing to commit — return current HEAD
      const sha = execSync("git rev-parse HEAD", {
        cwd: repoPath,
        encoding: "utf-8",
      }).trim();
      return { sha };
    }

    const message = `[trellai] ${cardTitle} (card:${cardId})`;
    execSync(`git commit -m ${JSON.stringify(message)}`, {
      cwd: repoPath,
      stdio: "pipe",
    });

    const sha = execSync("git rev-parse HEAD", {
      cwd: repoPath,
      encoding: "utf-8",
    }).trim();

    return { sha };
  }

  getDiffForCommit(repoPath: string, commitSha: string): string {
    try {
      return execSync(`git diff ${commitSha}^..${commitSha}`, {
        cwd: repoPath,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch {
      return "";
    }
  }

  revertCommit(
    repoPath: string,
    commitSha: string
  ): { success: boolean; error?: string } {
    try {
      execSync(`git revert ${commitSha} --no-edit`, {
        cwd: repoPath,
        stdio: "pipe",
      });
      return { success: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      // Abort failed revert
      try {
        execSync("git revert --abort", { cwd: repoPath, stdio: "pipe" });
      } catch {
        // Ignore
      }
      return { success: false, error };
    }
  }

  hasUncommittedChanges(repoPath: string): boolean {
    const output = execSync("git status --porcelain", {
      cwd: repoPath,
      encoding: "utf-8",
    }).trim();
    return output.length > 0;
  }
}

export const queueManager = new QueueManager();
