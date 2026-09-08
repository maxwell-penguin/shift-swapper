import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/swap-preferences -> every open or matched preference in your group (the Swap Market)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const groupId = (session.user as any).groupId;
  if (!groupId) return NextResponse.json({ error: "join a group first" }, { status: 403 });

  const preferences = await db.swapPreference.findMany({
    where: { groupId, status: { in: ["open", "matched"] } },
    include: {
      user: { select: { id: true, name: true } },
      giveShift: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(preferences);
}

// POST /api/swap-preferences
//   { giveShiftId, acceptableShiftIds?: string[], acceptableFromDate?, acceptableToDate?, acceptableTimeOfDay? }
// Posts "I want this shift off; here's what I'd take instead" to the multi-way market.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const groupId = (session.user as any).groupId;
  if (!groupId) return NextResponse.json({ error: "join a group first" }, { status: 403 });
  const userId = (session.user as any).id;

  const { giveShiftId, acceptableShiftIds, acceptableFromDate, acceptableToDate, acceptableTimeOfDay } =
    await req.json();
  if (!giveShiftId) return NextResponse.json({ error: "giveShiftId required" }, { status: 400 });

  const shift = await db.shift.findUnique({ where: { id: giveShiftId } });
  if (!shift || shift.ownerId !== userId) {
    return NextResponse.json({ error: "you can only post a preference for your own shift" }, { status: 403 });
  }

  const existing = await db.swapPreference.findFirst({
    where: { giveShiftId, status: { in: ["open", "matched"] } },
  });
  if (existing) {
    return NextResponse.json({ error: "you already have an active preference for this shift" }, { status: 409 });
  }

  const preference = await db.swapPreference.create({
    data: {
      userId,
      groupId,
      giveShiftId,
      acceptableShiftIds: Array.isArray(acceptableShiftIds) ? acceptableShiftIds : [],
      acceptableFromDate: acceptableFromDate ? new Date(`${acceptableFromDate}T00:00:00Z`) : null,
      acceptableToDate: acceptableToDate ? new Date(`${acceptableToDate}T00:00:00Z`) : null,
      acceptableTimeOfDay: acceptableTimeOfDay || null,
    },
    include: { user: { select: { id: true, name: true } }, giveShift: true },
  });

  return NextResponse.json(preference, { status: 201 });
}
