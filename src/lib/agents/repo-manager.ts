/**
 * Repo manager for shared mode — handles cloning, pulling, and pushing repos.
 *
 * In shared mode, each developer needs a local clone of the project's repo.
 * This module manages the workspace directory and git operations for remote repos.
 */

import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

const DEFAULT_WORKSPACE_DIR = path.join(os.homedir(), ".trellai", "workspaces");

function getWorkspaceDir(): string {
  const envDir = process.env.TRELLAI_WORKSPACE_DIR;
  if (envDir) {
    // Expand ~ to home directory
    return envDir.startsWith("~")
      ? path.join(os.homedir(), envDir.slice(1))
      : envDir;
  }
  return DEFAULT_WORKSPACE_DIR;
}

export class RepoManager {
  /**
   * Ensure a repo is cloned locally. If it already exists, pull latest.
   * Returns the local path to the repo.
   */
  async ensureRepo(
    repoUrl: string,
    projectName: string,
    overridePath?: string
  ): Promise<string> {
    if (overridePath && fs.existsSync(overridePath)) {
      // User has a custom local path — just pull latest
      await this.pullLatest(overridePath);
      return overridePath;
    }

    const workspaceDir = getWorkspaceDir();
    const safeName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const targetDir = path.join(workspaceDir, safeName);

    if (fs.existsSync(path.join(targetDir, ".git"))) {
      // Already cloned — pull latest
      await this.pullLatest(targetDir);
      return targetDir;
    }

    // Clone the repo
    await this.cloneRepo(repoUrl, targetDir);
    return targetDir;
  }

  /**
   * Clone a repo to the target directory.
   */
  async cloneRepo(repoUrl: string, targetDir: string): Promise<string> {
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });

    console.log(`[repo-manager] Cloning ${repoUrl} to ${targetDir}...`);
    execSync(`git clone "${repoUrl}" "${targetDir}"`, {
      stdio: "pipe",
      timeout: 120_000, // 2 minute timeout for clone
    });
    console.log(`[repo-manager] Clone complete: ${targetDir}`);

    return targetDir;
  }

  /**
   * Pull latest changes from remote.
   */
  async pullLatest(repoPath: string): Promise<void> {
    try {
      execSync("git pull --ff-only", {
        cwd: repoPath,
        stdio: "pipe",
        timeout: 30_000,
      });
    } catch {
      // Pull may fail if there are local changes or no remote — that's OK
      console.warn(`[repo-manager] git pull failed for ${repoPath} (non-fatal)`);
    }
  }

  /**
   * Push a branch to the remote origin.
   */
  async pushBranch(repoPath: string, branchName: string): Promise<void> {
    console.log(`[repo-manager] Pushing branch ${branchName} from ${repoPath}...`);
    execSync(`git push origin ${branchName}`, {
      cwd: repoPath,
      stdio: "pipe",
      timeout: 60_000,
    });
    console.log(`[repo-manager] Push complete: ${branchName}`);
  }

  /**
   * Push the main branch to remote after a merge.
   */
  async pushMain(repoPath: string): Promise<void> {
    const mainBranch = this.getMainBranch(repoPath);
    console.log(`[repo-manager] Pushing ${mainBranch} from ${repoPath}...`);
    execSync(`git push origin ${mainBranch}`, {
      cwd: repoPath,
      stdio: "pipe",
      timeout: 60_000,
    });
    console.log(`[repo-manager] Push complete: ${mainBranch}`);
  }

  /**
   * Delete a remote branch after merge.
   */
  async deleteRemoteBranch(
    repoPath: string,
    branchName: string
  ): Promise<void> {
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

  /**
   * Remove a local clone entirely.
   */
  async removeClone(repoPath: string): Promise<void> {
    if (fs.existsSync(repoPath)) {
      fs.rmSync(repoPath, { recursive: true, force: true });
      console.log(`[repo-manager] Removed clone: ${repoPath}`);
    }
  }

  /**
   * Check if a path looks like a GitHub URL.
   */
  static isGitUrl(input: string): boolean {
    return (
      input.startsWith("https://github.com/") ||
      input.startsWith("git@github.com:") ||
      input.startsWith("https://gitlab.com/") ||
      input.startsWith("git@gitlab.com:") ||
      input.endsWith(".git")
    );
  }

  private getMainBranch(repoPath: string): string {
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

export const repoManager = new RepoManager();
