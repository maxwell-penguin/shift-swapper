import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { sendCycleDeniedEmail } from "@/lib/email";

// PATCH /api/swap-cycles/:id/deny
// RLC said no (an admin marks it), or a participant backs out themselves. No
// shifts change owner — every preference in the cycle returns to "open" so
// it can be matched again later.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const groupId = (session.user as any).groupId;
  const role = (session.user as any).role;

  const cycle = await db.swapCycle.findUnique({
    where: { id: params.id },
    include: { preferences: { include: { user: true } } },
  });
  if (!cycle || cycle.groupId !== groupId) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (cycle.status === "approved") return NextResponse.json({ error: "already approved" }, { status: 409 });
  if (!cycle.preferences.some((p) => p.userId === userId) && role !== "ADMIN") {
    return NextResponse.json({ error: "only a participant or a group admin can do this" }, { status: 403 });
  }

  await db.$transaction(async (tx) => {
    await tx.swapPreference.updateMany({
      where: { cycleId: cycle.id },
      data: { status: "open", cycleId: null, matchedWithId: null, agreedAt: null },
    });
    await tx.swapCycle.update({ where: { id: cycle.id }, data: { status: "denied" } });
  });

  const size = cycle.preferences.length;
  const title = "Trade denied";
  const body = `Your ${size}-way trade was denied — your preference is back on the market.`;
  await Promise.all(
    cycle.preferences.map((p) =>
      notify({ userId: p.userId, groupId, type: "cycle_denied", title, body, href: "/market" }),
    ),
  );
  await sendCycleDeniedEmail({ emails: cycle.preferences.map((p) => p.user.email), size });

  return NextResponse.json({ ok: true });
}
