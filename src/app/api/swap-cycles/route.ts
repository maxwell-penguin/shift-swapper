import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/swap-cycles -> every proposed/agreed multi-way trade, with each
// participant's give-shift and (once matched) what they'll receive
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cycles = await db.swapCycle.findMany({
    where: { status: { in: ["proposed", "all_agreed", "pending_approval"] } },
    include: {
      preferences: {
        include: {
          user: { select: { id: true, name: true } },
          giveShift: true,
          matchedWith: {
            include: { giveShift: true, user: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(cycles);
}
