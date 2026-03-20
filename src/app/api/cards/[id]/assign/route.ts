import { NextRequest, NextResponse } from "next/server";
import { getLocalRepositories } from "@/lib/db/repositories";
import { getAuthUser, unauthorized, assertCardAccess } from "@/lib/auth";

const repos = getLocalRepositories();

/**
 * POST /api/cards/[id]/assign — Assign a card to a user
 * Body: { assignedTo: string }  (userId)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const hasAccess = await assertCardAccess(id, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const body = await req.json();
  const { assignedTo } = body;

  if (!assignedTo) {
    return NextResponse.json(
      { error: "assignedTo is required" },
      { status: 400 }
    );
  }

  await repos.cards.update(id, {
    assignedTo,
    updatedAt: new Date().toISOString(),
  });

  const card = await repos.cards.findById(id);
  return NextResponse.json(card);
}

/**
 * DELETE /api/cards/[id]/assign — Unassign a card
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const hasAccess = await assertCardAccess(id, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  await repos.cards.update(id, {
    assignedTo: null,
    updatedAt: new Date().toISOString(),
  });

  const card = await repos.cards.findById(id);
  return NextResponse.json(card);
}
