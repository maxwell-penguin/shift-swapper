import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isBeforeToday } from "@/lib/dates";
import { notify } from "@/lib/notify";
import { sendSwapTargetedEmail } from "@/lib/email";

// GET /api/swaps  -> the swap board: everything not yet approved/denied, scoped to your group
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const groupId = (session.user as any).groupId;
  if (!groupId) return NextResponse.json({ error: "join a group first" }, { status: 403 });

  const swaps = await db.swapRequest.findMany({
    where: { groupId, status: { in: ["open", "mutual", "pending_approval"] } },
    include: {
      shift: true,
      requester: { select: { id: true, name: true } },
      acceptedBy: { select: { id: true, name: true } },
      offeredShift: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(swaps);
}

// POST /api/swaps  { shiftId, targetId? }
// Posts "I need this shift covered", optionally aimed at one person. What the
// acceptor offers back (if anything) is supplied when they accept, not here —
// letting the requester set it up front had no ownership check behind it.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const groupId = (session.user as any).groupId;
  if (!groupId) return NextResponse.json({ error: "join a group first" }, { status: 403 });

  const { shiftId, targetId } = await req.json();
  const userId = (session.user as any).id;

  const shift = await db.shift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.ownerId !== userId || shift.groupId !== groupId) {
    return NextResponse.json({ error: "you can only post a swap for your own shift" }, { status: 403 });
  }
  if (isBeforeToday(shift.date)) {
    return NextResponse.json({ error: "can't post a swap for a shift that's already passed" }, { status: 409 });
  }

  let target: { id: string; email: string; groupId: string | null } | null = null;
  if (targetId) {
    target = await db.user.findUnique({ where: { id: targetId } });
    if (!target || target.groupId !== groupId) {
      return NextResponse.json({ error: "that person isn't in your group" }, { status: 400 });
    }
  }

  const existingSwap = await db.swapRequest.findFirst({
    where: { shiftId, status: { in: ["open", "mutual"] } },
  });
  if (existingSwap) {
    return NextResponse.json({ error: "there's already an active swap request on this shift" }, { status: 409 });
  }

  const existingPreference = await db.swapPreference.findFirst({
    where: { giveShiftId: shiftId, status: { in: ["open", "matched"] } },
  });
  if (existingPreference) {
    return NextResponse.json({ error: "this shift is already posted to the swap market" }, { status: 409 });
  }

  const swap = await db.swapRequest.create({
    data: { shiftId, groupId, requesterId: userId, targetId: targetId ?? null },
  });

  if (target) {
    const requesterName = (session.user as any).name || "Someone";
    const dateStr = shift.date.toISOString().slice(0, 10);
    await notify({
      userId: target.id,
      groupId,
      type: "swap_targeted",
      title: "Cover request",
      body: `${requesterName} wants you to cover their ${dateStr} shift`,
      href: "/swaps",
    });
    await sendSwapTargetedEmail({
      targetEmail: target.email,
      requesterName,
      shiftDate: dateStr,
      startTime: shift.startTime,
      endTime: shift.endTime,
    });
  }

  return NextResponse.json(swap, { status: 201 });
}
