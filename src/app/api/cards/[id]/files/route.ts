import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { files, cards } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cardFiles = db
    .select()
    .from(files)
    .where(eq(files.cardId, id))
    .all();
  return NextResponse.json(cardFiles);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const card = db.select().from(cards).where(eq(cards.id, id)).get();
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const uploadedFiles = formData.getAll("files") as File[];

  if (uploadedFiles.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const dir = path.join(UPLOADS_DIR, card.projectId, "cards", id);
  fs.mkdirSync(dir, { recursive: true });

  const created = [];

  for (const file of uploadedFiles) {
    const shortId = uuid().substring(0, 8);
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedFilename = `${shortId}-${safeFilename}`;
    const storedPath = path.join(dir, storedFilename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(storedPath, buffer);

    const record = {
      id: uuid(),
      projectId: card.projectId,
      cardId: id,
      filename: file.name,
      storedPath,
      mimeType: file.type || "application/octet-stream",
      size: buffer.length,
      createdAt: new Date().toISOString(),
    };

    db.insert(files).values(record).run();
    created.push(record);
  }

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const file = db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.cardId, id)))
    .get();

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Remove from disk
  try {
    fs.unlinkSync(file.storedPath);
  } catch {
    // File may already be gone
  }

  db.delete(files).where(eq(files.id, fileId)).run();
  return NextResponse.json({ success: true });
}
