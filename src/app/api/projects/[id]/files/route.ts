import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { files, projects } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectFiles = db
    .select()
    .from(files)
    .where(and(eq(files.projectId, id), isNull(files.cardId)))
    .all();
  return NextResponse.json(projectFiles);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const uploadedFiles = formData.getAll("files") as File[];

  if (uploadedFiles.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const dir = path.join(UPLOADS_DIR, id, "files");
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
      projectId: id,
      cardId: null,
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
    .where(and(eq(files.id, fileId), eq(files.projectId, id), isNull(files.cardId)))
    .get();

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    fs.unlinkSync(file.storedPath);
  } catch {
    // File may already be gone
  }

  db.delete(files).where(eq(files.id, fileId)).run();
  return NextResponse.json({ success: true });
}
