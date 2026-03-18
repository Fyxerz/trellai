import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { v4 as uuid } from "uuid";
import fs from "fs";
import path from "path";

const repos = getLocalRepositories();
const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectFiles = repos.files.findByProjectId(id);
  return NextResponse.json(projectFiles);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = repos.projects.findById(id);
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

    repos.files.create(record);
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

  const file = repos.files.findByIdAndProjectId(fileId, id);

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    fs.unlinkSync(file.storedPath);
  } catch {
    // File may already be gone
  }

  repos.files.delete(fileId);
  return NextResponse.json({ success: true });
}
