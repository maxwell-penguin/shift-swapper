import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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

// POST /api/swaps  { shiftId, targetId?, offeredShiftId? }
// Posts "I need this shift covered", optionally aimed at one person,
// optionally offering one of your own shifts back for a true swap.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const groupId = (session.user as any).groupId;
  if (!groupId) return NextResponse.json({ error: "join a group first" }, { status: 403 });

  const { shiftId, targetId, offeredShiftId } = await req.json();
  const userId = (session.user as any).id;

  const shift = await db.shift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.ownerId !== userId) {
    return NextResponse.json({ error: "you can only post a swap for your own shift" }, { status: 403 });
  }

  const swap = await db.swapRequest.create({
    data: {
      shiftId,
      groupId,
      requesterId: userId,
      targetId: targetId ?? null,
      offeredShiftId: offeredShiftId ?? null,
    },
  });

  return NextResponse.json(swap, { status: 201 });
}
