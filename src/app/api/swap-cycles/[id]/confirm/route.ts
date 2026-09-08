import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH /api/swap-cycles/:id/confirm
// The calling user agrees to their leg of this cycle. Once every participant
// has confirmed, the cycle moves to "all_agreed" — the N-way version of the
// 2-person "mutual" step.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const groupId = (session.user as any).groupId;

  const cycle = await db.swapCycle.findUnique({
    where: { id: params.id },
    include: { preferences: true },
  });
  if (!cycle || cycle.status !== "proposed" || cycle.groupId !== groupId) {
    return NextResponse.json({ error: "this cycle isn't open for confirmation" }, { status: 409 });
  }

  const myPref = cycle.preferences.find((p) => p.userId === userId);
  if (!myPref) return NextResponse.json({ error: "you're not part of this cycle" }, { status: 403 });

  await db.swapPreference.update({ where: { id: myPref.id }, data: { agreedAt: new Date() } });

  const refreshed = await db.swapPreference.findMany({ where: { cycleId: cycle.id } });
  const allAgreed = refreshed.every((p) => p.agreedAt !== null);
  if (allAgreed) {
    await db.swapCycle.update({ where: { id: cycle.id }, data: { status: "all_agreed" } });
  }

  return NextResponse.json({ ok: true, allAgreed });
}
