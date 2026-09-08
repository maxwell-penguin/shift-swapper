import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendSwapAgreedEmail } from "@/lib/email";

// PATCH /api/swaps/:id/accept
// The other person agrees to take the shift. Nothing changes on the schedule
// yet — this just logs mutual agreement and emails both people re: RLC approval.
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

  const acceptedBy = await db.user.findUnique({ where: { id: userId } });

  const updated = await db.swapRequest.update({
    where: { id: params.id },
    data: { acceptedById: userId, status: "mutual" },
  });

  await sendSwapAgreedEmail({
    requesterEmail: swap.requester.email,
    requesterName: swap.requester.name,
    acceptedByEmail: acceptedBy!.email,
    acceptedByName: acceptedBy!.name,
    shiftDate: swap.shift.date.toISOString().slice(0, 10),
    startTime: swap.shift.startTime,
    endTime: swap.shift.endTime,
  });

  return NextResponse.json(updated);
}
