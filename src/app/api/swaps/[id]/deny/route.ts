import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH /api/swaps/:id/deny
// RLC said no (or a party wants to back out). No shifts change owner.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const groupId = (session.user as any).groupId;

  const swap = await db.swapRequest.findUnique({ where: { id: params.id } });
  if (!swap || swap.groupId !== groupId) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (userId !== swap.requesterId && userId !== swap.acceptedById) {
    return NextResponse.json({ error: "only the two people involved can do this" }, { status: 403 });
  }

  const updated = await db.swapRequest.update({
    where: { id: params.id },
    data: { status: "denied" },
  });

  return NextResponse.json(updated);
}
