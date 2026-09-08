import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { findTradeCycles, type PreferenceNode } from "@/lib/matching";
import { notify } from "@/lib/notify";
import { sendCycleMatchedEmail } from "@/lib/email";

// POST /api/swap-cycles/find-matches
// Runs Top Trading Cycles over every open preference and groups whatever
// closed loops it finds into new SwapCycle rows (2-node loops included —
// those are just ordinary direct swaps found the same way).
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const groupId = (session.user as any).groupId;
  if (!groupId) return NextResponse.json({ error: "join a group first" }, { status: 403 });

  // Scoped to one group — otherwise the matcher could chain someone's shift
  // to a person in a completely different residence.
  const openPrefs = await db.swapPreference.findMany({
    where: { status: "open", groupId },
    include: { giveShift: true, user: true },
  });
  const prefById = new Map(openPrefs.map((p) => [p.id, p]));

  const nodes: PreferenceNode[] = openPrefs.map((p) => ({
    id: p.id,
    userId: p.userId,
    groupId: p.groupId,
    giveShiftId: p.giveShiftId,
    giveShiftDate: p.giveShift.date,
    giveShiftStartTime: p.giveShift.startTime,
    acceptableShiftIds: p.acceptableShiftIds,
    acceptableFromDate: p.acceptableFromDate,
    acceptableToDate: p.acceptableToDate,
    acceptableTimeOfDay: p.acceptableTimeOfDay,
  }));

  const cycles = findTradeCycles(nodes);

  await db.$transaction(async (tx) => {
    for (const cycleMatches of cycles) {
      const cycle = await tx.swapCycle.create({ data: { status: "proposed", groupId } });
      for (const { preferenceId, matchedWithId } of cycleMatches) {
        await tx.swapPreference.update({
          where: { id: preferenceId },
          data: { status: "matched", cycleId: cycle.id, matchedWithId },
        });
      }
    }
  });

  for (const cycleMatches of cycles) {
    const size = cycleMatches.length;
    const title = "New trade match";
    const body = `You've been matched in a ${size}-way trade — confirm your part.`;
    const members = cycleMatches.map(({ preferenceId }) => prefById.get(preferenceId)!);
    await Promise.all(
      members.map((p) => notify({ userId: p.userId, groupId, type: "cycle_proposed", title, body, href: "/market" })),
    );
    await sendCycleMatchedEmail({ emails: members.map((p) => p.user.email), size });
  }

  return NextResponse.json({ cyclesFound: cycles.length, sizes: cycles.map((c) => c.length) });
}
