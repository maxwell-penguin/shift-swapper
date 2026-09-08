import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { sendSwapDeniedEmail } from "@/lib/email";

// PATCH /api/swaps/:id/deny
// RLC said no (an admin marks it), or either party backs out themselves.
// No shifts change owner.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const groupId = (session.user as any).groupId;
  const role = (session.user as any).role;

  const swap = await db.swapRequest.findUnique({
    where: { id: params.id },
    include: { shift: true, requester: true, acceptedBy: true },
  });
  if (!swap || swap.groupId !== groupId) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (userId !== swap.requesterId && userId !== swap.acceptedById && role !== "ADMIN") {
    return NextResponse.json({ error: "only the two people involved or a group admin can do this" }, { status: 403 });
  }

  const updated = await db.swapRequest.update({
    where: { id: params.id },
    data: { status: "denied" },
  });

  const dateStr = swap.shift.date.toISOString().slice(0, 10);
  const title = "Swap denied";
  const body = `Your ${dateStr} shift swap was denied.`;
  const notifyTargets = [swap.requesterId, ...(swap.acceptedById ? [swap.acceptedById] : [])];
  await Promise.all(
    notifyTargets.map((uid) => notify({ userId: uid, groupId, type: "swap_denied", title, body, href: "/swaps" })),
  );
  if (swap.acceptedBy) {
    await sendSwapDeniedEmail({
      requesterEmail: swap.requester.email,
      acceptedByEmail: swap.acceptedBy.email,
      shiftDate: dateStr,
      startTime: swap.shift.startTime,
      endTime: swap.shift.endTime,
    });
  }

  return NextResponse.json(updated);
}
