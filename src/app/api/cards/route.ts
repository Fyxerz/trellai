import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { getAuthUser, unauthorized, assertProjectAccess } from "@/lib/auth";
import { v4 as uuid } from "uuid";

const repos = getLocalRepositories();

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  const hasAccess = await assertProjectAccess(projectId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allCards = await repos.cards.findByProjectId(projectId);

  // Attach checklist counts
  const enriched = await Promise.all(allCards.map(async (card) => {
    const items = await repos.checklistItems.findByCardId(card.id);
    return {
      ...card,
      testResults: card.testResults ? JSON.parse(card.testResults) : null,
      isIcebox: !!card.isIcebox,
      checklistTotal: items.length,
      checklistChecked: items.filter((i) => i.checked).length,
    };
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await req.json();

  const hasAccess = await assertProjectAccess(body.projectId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = uuid();
  const now = new Date().toISOString();

  // Get max position in the target column
  const existing = await repos.cards.findByProjectId(body.projectId);

  const columnCards = existing.filter(
    (c) => c.column === (body.column || "features")
  );
  const maxPos = columnCards.reduce(
    (max, c) => Math.max(max, c.position),
    -1
  );

  await repos.cards.create({
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

  const card = await repos.cards.findById(id);
  return NextResponse.json({
    ...card,
    testResults: card?.testResults ? JSON.parse(card.testResults) : null,
    isIcebox: !!card?.isIcebox,
  }, { status: 201 });
}
