import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { v4 as uuid } from "uuid";

const repos = getLocalRepositories();

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  const allCards = repos.cards.findByProjectId(projectId);

  // Attach checklist counts
  const enriched = allCards.map((card) => {
    const items = repos.checklistItems.findByCardId(card.id);
    return {
      ...card,
      testResults: card.testResults ? JSON.parse(card.testResults) : null,
      checklistTotal: items.length,
      checklistChecked: items.filter((i) => i.checked).length,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = uuid();
  const now = new Date().toISOString();

  // Get max position in the target column
  const existing = repos.cards.findByProjectId(body.projectId);

  const columnCards = existing.filter(
    (c) => c.column === (body.column || "features")
  );
  const maxPos = columnCards.reduce(
    (max, c) => Math.max(max, c.position),
    -1
  );

  repos.cards.create({
    id,
    projectId: body.projectId,
    title: body.title,
    description: body.description || "",
    type: body.type || "feature",
    column: body.column || "features",
    position: maxPos + 1,
    agentStatus: "idle",
    createdAt: now,
    updatedAt: now,
  });

  const card = repos.cards.findById(id);
  return NextResponse.json(card, { status: 201 });
}
