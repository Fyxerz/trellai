import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;

  const file = db.select().from(files).where(eq(files.id, fileId)).get();
  if (!file) {
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
