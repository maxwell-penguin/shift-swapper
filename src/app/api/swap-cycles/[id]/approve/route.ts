import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH /api/swap-cycles/:id/approve
// Any participant marks this once the RLC has actually said yes. This is the
// ONLY step that changes shift ownership — every leg of the cycle reassigns
// in one transaction, or none do.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const cycle = await db.swapCycle.findUnique({
    where: { id: params.id },
    include: { preferences: { include: { matchedFrom: true } } },
  });
  if (!cycle || cycle.status !== "all_agreed") {
    return NextResponse.json({ error: "every participant must agree before this can be approved" }, { status: 409 });
  }
  if (!cycle.preferences.some((p) => p.userId === userId)) {
    return NextResponse.json({ error: "only a participant can confirm approval" }, { status: 403 });
  }

  const result = await db.$transaction(async (tx) => {
    for (const pref of cycle.preferences) {
      if (!pref.matchedFrom) continue;
      await tx.shift.update({ where: { id: pref.giveShiftId }, data: { ownerId: pref.matchedFrom.userId } });
    }
    return tx.swapCycle.update({ where: { id: cycle.id }, data: { status: "approved" } });
  });

  return NextResponse.json(result);
}
