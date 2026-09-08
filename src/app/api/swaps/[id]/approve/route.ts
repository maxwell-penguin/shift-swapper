import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { sendSwapApprovedEmail } from "@/lib/email";

// PATCH /api/swaps/:id/approve
// A group admin marks this once the RLC has actually said yes.
// This is the ONLY step that changes who owns which shift.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const groupId = (session.user as any).groupId;
  const role = (session.user as any).role;

  const swap = await db.swapRequest.findUnique({
    where: { id: params.id },
    include: { shift: true, requester: true, acceptedBy: true },
  });
  if (!swap || swap.status !== "mutual" || swap.groupId !== groupId) {
    return NextResponse.json({ error: "swap must be in mutual-agreement state first" }, { status: 409 });
  }
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "only a group admin can approve" }, { status: 403 });
  }

  const result = await db.$transaction(async (tx) => {
    // hand the requester's shift to whoever accepted it
    await tx.shift.update({
      where: { id: swap.shiftId },
      data: { ownerId: swap.acceptedById! },
    });

    // if it's a true two-way swap, hand the offered shift back the other direction
    if (swap.offeredShiftId) {
      await tx.shift.update({
        where: { id: swap.offeredShiftId },
        data: { ownerId: swap.requesterId },
      });
    }

    return tx.swapRequest.update({
      where: { id: swap.id },
      data: { status: "approved" },
    });
  });

  const dateStr = swap.shift.date.toISOString().slice(0, 10);
  const title = "Swap approved";
  const body = `Your ${dateStr} shift swap is approved and final.`;
  await Promise.all([
    notify({ userId: swap.requesterId, groupId, type: "swap_approved", title, body, href: "/swaps" }),
    notify({ userId: swap.acceptedById!, groupId, type: "swap_approved", title, body, href: "/swaps" }),
  ]);
  await sendSwapApprovedEmail({
    requesterEmail: swap.requester.email,
    acceptedByEmail: swap.acceptedBy!.email,
    shiftDate: dateStr,
    startTime: swap.shift.startTime,
    endTime: swap.shift.endTime,
  });

  return NextResponse.json(result);
}
