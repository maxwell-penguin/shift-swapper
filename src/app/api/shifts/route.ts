import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isBeforeToday } from "@/lib/dates";

// GET /api/shifts?month=2026-10  -> everyone's shifts for that month, scoped to your group
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const groupId = (session.user as any).groupId;
  if (!groupId) return NextResponse.json({ error: "join a group first" }, { status: 403 });

  const month = req.nextUrl.searchParams.get("month"); // "YYYY-MM"
  if (!month) return NextResponse.json({ error: "month query param required" }, { status: 400 });

  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const shifts = await db.shift.findMany({
    where: { groupId, date: { gte: start, lt: end } },
    include: { owner: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(shifts);
}

// POST /api/shifts  { date: "2026-10-14", startTime: "19:00", endTime: "08:00" }
// Adds a shift for the logged-in user (self-entry — this is how the schedule gets populated)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const groupId = (session.user as any).groupId;
  if (!groupId) return NextResponse.json({ error: "join a group first" }, { status: 403 });

  const { date, startTime, endTime } = await req.json();
  if (!date || !startTime || !endTime) {
    return NextResponse.json({ error: "date, startTime, endTime required" }, { status: 400 });
  }

  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (isBeforeToday(parsedDate)) {
    return NextResponse.json({ error: "can't add a shift in the past" }, { status: 400 });
  }

  try {
    const shift = await db.shift.create({
      data: {
        ownerId: (session.user as any).id,
        groupId,
        date: parsedDate,
        startTime,
        endTime,
      },
    });
    return NextResponse.json(shift, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "You already have a shift on that date." }, { status: 409 });
    }
    throw e;
  }
}
