import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { getAuthUser, unauthorized } from "@/lib/auth";

export async function POST() {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  try {
    const script = `
      set chosenFolder to POSIX path of (choose folder with prompt "Select a project folder")
      return chosenFolder
    `;
    const result = execSync(`osascript -e '${script}'`, {
      encoding: "utf-8",
      timeout: 60000,
    }).trim();

    // osascript returns path with trailing slash, remove it
    const folderPath = result.endsWith("/") ? result.slice(0, -1) : result;

    return NextResponse.json({ path: folderPath });
  } catch {
    // User cancelled the dialog or error occurred
    return NextResponse.json({ path: null });
  }
}
