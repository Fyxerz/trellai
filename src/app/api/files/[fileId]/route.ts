import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { getOptionalUser, assertProjectAccessForUser } from "@/lib/auth";
import fs from "fs";

const repos = getLocalRepositories();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const user = await getOptionalUser();

  const { fileId } = await params;

  const file = await repos.files.findById(fileId);
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Verify access through the file's parent project
  const hasAccess = await assertProjectAccessForUser(file.projectId, user);
  if (!hasAccess) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const buffer = fs.readFileSync(file.storedPath);
    const headers: Record<string, string> = {
      "Content-Type": file.mimeType,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
      "Cache-Control": "private, max-age=3600",
    };

    return new NextResponse(buffer, { headers });
  } catch {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }
}
