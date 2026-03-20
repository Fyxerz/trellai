import { execSync } from "child_process";
import path from "path";
import fs from "fs";

export class WorktreeManager {
  createWorktree(
    repoPath: string,
    branchName: string
  ): { worktreePath: string; branchName: string } {
    const worktreeBase = path.join(repoPath, ".worktrees");
    fs.mkdirSync(worktreeBase, { recursive: true });

    const worktreePath = path.join(worktreeBase, branchName);

    // Create branch from current HEAD if it doesn't exist
    try {
      execSync(`git branch ${branchName}`, { cwd: repoPath, stdio: "pipe" });
    } catch {
      // Branch may already exist
    }

    // Create worktree
    try {
      execSync(`git worktree add "${worktreePath}" ${branchName}`, {
        cwd: repoPath,
        stdio: "pipe",
      });
    } catch (e) {
      // Worktree may already exist
      if (!fs.existsSync(worktreePath)) {
        throw e;
      }
    }

    return { worktreePath, branchName };
  }

  deleteWorktree(repoPath: string, worktreePath: string, branchName: string) {
    try {
      execSync(`git worktree remove "${worktreePath}" --force`, {
        cwd: repoPath,
        stdio: "pipe",
      });
    } catch {
      // Try manual removal
      if (fs.existsSync(worktreePath)) {
        fs.rmSync(worktreePath, { recursive: true, force: true });
        try {
          execSync("git worktree prune", { cwd: repoPath, stdio: "pipe" });
        } catch {
          // Ignore
        }
      }
    }

    // Delete the branch
    try {
      execSync(`git branch -D ${branchName}`, {
        cwd: repoPath,
        stdio: "pipe",
      });
    } catch {
      // Branch may not exist
    }
  }

  getDiff(repoPath: string, branchName: string): string {
    try {
      const mainBranch = this.getMainBranch(repoPath);
      return execSync(
        `git diff ${mainBranch}...${branchName}`,
        { cwd: repoPath, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
      );
    } catch {
      return "";
    }
  }

  mergeBranch(repoPath: string, branchName: string): { success: boolean; error?: string } {
    try {
      // Verify branch exists before attempting merge
      try {
        execSync(`git rev-parse --verify refs/heads/${branchName}`, { cwd: repoPath, stdio: "pipe" });
      } catch {
        return { success: false, error: `Branch '${branchName}' does not exist. It may have already been merged or deleted.` };
      }

      const mainBranch = this.getMainBranch(repoPath);
      execSync(`git checkout ${mainBranch}`, { cwd: repoPath, stdio: "pipe" });
      execSync(`git merge ${branchName} --no-ff -m "Merge ${branchName}"`, {
        cwd: repoPath,
        stdio: "pipe",
      });
      return { success: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      // Abort failed merge
      try {
        execSync("git merge --abort", { cwd: repoPath, stdio: "pipe" });
      } catch {
        // Ignore
      }
      return { success: false, error };
    }
  }

  getModifiedFiles(repoPath: string, branchName: string): string[] {
    try {
      const mainBranch = this.getMainBranch(repoPath);
      const output = execSync(
        `git diff --name-only ${mainBranch}...${branchName}`,
        { cwd: repoPath, encoding: "utf-8" }
      ).trim();
      return output ? output.split("\n") : [];
    } catch {
      return [];
    }
  }

  /**
   * Push a branch to the remote origin.
   * Used in shared mode after agent completes work.
   */
  pushBranch(repoPath: string, branchName: string): { success: boolean; error?: string } {
    try {
      execSync(`git push origin ${branchName}`, {
        cwd: repoPath,
        stdio: "pipe",
        timeout: 60_000,
      });
      return { success: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return { success: false, error };
    }
  }

  /**
   * Push the main branch to remote after a merge.
   */
  pushMain(repoPath: string): { success: boolean; error?: string } {
    try {
      const mainBranch = this.getMainBranch(repoPath);
      execSync(`git push origin ${mainBranch}`, {
        cwd: repoPath,
        stdio: "pipe",
        timeout: 60_000,
      });
      return { success: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return { success: false, error };
    }
  }

  /**
   * Pull latest changes from remote on the main branch.
   */
  pullLatest(repoPath: string): { success: boolean; error?: string } {
    try {
      execSync("git pull --ff-only", {
        cwd: repoPath,
        stdio: "pipe",
        timeout: 30_000,
      });
      return { success: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return { success: false, error };
    }
  }

  /**
   * Delete a remote branch (cleanup after merge).
   */
  deleteRemoteBranch(repoPath: string, branchName: string): void {
    try {
      execSync(`git push origin --delete ${branchName}`, {
        cwd: repoPath,
        stdio: "pipe",
        timeout: 30_000,
      });
    } catch {
      // Remote branch may not exist — that's OK
    }
  }

  getMainBranch(repoPath: string): string {
    try {
      const result = execSync(
        "git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || echo refs/heads/main",
        { cwd: repoPath, encoding: "utf-8" }
      ).trim();
      return result.split("/").pop() || "main";
    } catch {
      return "main";
    }
  }
}

export const worktreeManager = new WorktreeManager();
