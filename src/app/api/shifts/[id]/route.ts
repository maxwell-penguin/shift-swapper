import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH /api/shifts/:id  { startTime?, endTime? } — adjust your own shift's times
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const groupId = (session.user as any).groupId;

  const shift = await db.shift.findUnique({ where: { id: params.id } });
  if (!shift || shift.ownerId !== userId || shift.groupId !== groupId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { startTime, endTime } = await req.json();
  const updated = await db.shift.update({
    where: { id: params.id },
    data: {
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
    },
    include: { owner: { select: { id: true, name: true } } },
  });

  return NextResponse.json(updated);
}

// DELETE /api/shifts/:id — remove your own shift
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const groupId = (session.user as any).groupId;

  const shift = await db.shift.findUnique({ where: { id: params.id } });
  if (!shift || shift.ownerId !== userId || shift.groupId !== groupId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const hasSwap = await db.swapRequest.findFirst({
    where: { OR: [{ shiftId: params.id }, { offeredShiftId: params.id }] },
  });
  if (hasSwap) {
    return NextResponse.json(
      { error: "Can't remove a shift that has a swap request on it." },
      { status: 409 },
    );
  }

  await db.shift.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
