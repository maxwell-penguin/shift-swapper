import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendSwapAgreedEmail } from "@/lib/email";
import { isBeforeToday } from "@/lib/dates";
import { notify } from "@/lib/notify";

// PATCH /api/swaps/:id/accept  { offeredShiftId? }
// The other person agrees to take the shift, optionally offering one of
// their own shifts back for a true two-way swap. Nothing changes on the
// schedule yet — this just logs mutual agreement and emails both people
// re: RLC approval.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const groupId = (session.user as any).groupId;

  const swap = await db.swapRequest.findUnique({
    where: { id: params.id },
    include: { shift: true, requester: true },
  });
  if (!swap || swap.status !== "open") {
    return NextResponse.json({ error: "swap not open" }, { status: 409 });
  }
  // An untargeted request has no requester/acceptedBy check to fall back on,
  // so without this, anyone signed in — from any group — could accept it.
  if (swap.groupId !== groupId) {
    return NextResponse.json({ error: "swap not open" }, { status: 409 });
  }
  if (swap.targetId && swap.targetId !== userId) {
    return NextResponse.json({ error: "this request was aimed at someone else" }, { status: 403 });
  }
  if (userId === swap.requesterId) {
    return NextResponse.json({ error: "you can't accept your own swap request" }, { status: 403 });
  }

  const { offeredShiftId } = await req.json().catch(() => ({ offeredShiftId: undefined }));

  let validatedOfferedShiftId: string | null = null;
  if (offeredShiftId) {
    const offeredShift = await db.shift.findUnique({ where: { id: offeredShiftId } });
    if (!offeredShift || offeredShift.ownerId !== userId || offeredShift.groupId !== groupId) {
      return NextResponse.json({ error: "you can only offer a shift of your own" }, { status: 403 });
    }
    if (isBeforeToday(offeredShift.date)) {
      return NextResponse.json({ error: "can't offer a shift that's already passed" }, { status: 409 });
    }
    const committedSwap = await db.swapRequest.findFirst({
      where: {
        status: { in: ["open", "mutual"] },
        OR: [{ shiftId: offeredShiftId }, { offeredShiftId }],
      },
    });
    if (committedSwap) {
      return NextResponse.json({ error: "that shift is already part of another swap" }, { status: 409 });
    }
    const committedPreference = await db.swapPreference.findFirst({
      where: { giveShiftId: offeredShiftId, status: { in: ["open", "matched"] } },
    });
    if (committedPreference) {
      return NextResponse.json({ error: "that shift is already posted to the swap market" }, { status: 409 });
    }
    validatedOfferedShiftId = offeredShiftId;
  }

  const acceptedBy = await db.user.findUnique({ where: { id: userId } });

  const updated = await db.swapRequest.update({
    where: { id: params.id },
    data: { acceptedById: userId, status: "mutual", offeredShiftId: validatedOfferedShiftId },
  });

  const dateStr = swap.shift.date.toISOString().slice(0, 10);

  await notify({
    userId: swap.requesterId,
    groupId,
    type: "swap_accepted",
    title: "Swap accepted",
    body: `${acceptedBy!.name || "Someone"} agreed to take your ${dateStr} shift — still needs admin approval.`,
    href: "/swaps",
  });

  await sendSwapAgreedEmail({
    requesterEmail: swap.requester.email,
    requesterName: swap.requester.name,
    acceptedByEmail: acceptedBy!.email,
    acceptedByName: acceptedBy!.name,
    shiftDate: dateStr,
    startTime: swap.shift.startTime,
    endTime: swap.shift.endTime,
  });

  return NextResponse.json(updated);
}
