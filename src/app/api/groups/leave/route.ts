import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/groups/leave
// Unwinds everything in-flight for the caller, then drops them from the group.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const groupId = (session.user as any).groupId;
  if (!groupId) return NextResponse.json({ error: "you're not in a group" }, { status: 403 });

  const [shifts, swapRequests, preferences, me] = await Promise.all([
    db.shift.findMany({ where: { ownerId: userId } }),
    db.swapRequest.findMany({
      where: { OR: [{ requesterId: userId }, { acceptedById: userId }] },
    }),
    db.swapPreference.findMany({
      where: { userId, status: { in: ["open", "matched"] } },
      include: { cycle: true },
    }),
    db.user.findUnique({ where: { id: userId } }),
  ]);

  const shiftIds = shifts.map((s) => s.id);
  const cycleIds = [...new Set(preferences.filter((p) => p.cycleId).map((p) => p.cycleId as string))];

  await db.$transaction(async (tx) => {
    // Matched preferences: deny the whole cycle so the other participants
    // aren't left waiting on someone who's gone — same reset the standalone
    // deny route does (open / cycleId null / matchedWithId null / agreedAt null).
    for (const cycleId of cycleIds) {
      await tx.swapPreference.updateMany({
        where: { cycleId },
        data: { status: "open", cycleId: null, matchedWithId: null, agreedAt: null },
      });
      await tx.swapCycle.update({ where: { id: cycleId }, data: { status: "denied" } });
    }

    // Their own open/mutual requests: nothing's final yet, nothing to preserve.
    await tx.swapRequest.deleteMany({
      where: { requesterId: userId, status: { in: ["open", "mutual"] } },
    });

    // Requests where they were the acceptor: reset to open so the requester's
    // post survives and can be re-accepted by someone else. offeredShiftId is
    // cleared too — it's about to (possibly) point at a shift of theirs that's
    // being deleted below, and a fresh acceptor means a fresh counter-offer anyway.
    await tx.swapRequest.updateMany({
      where: { acceptedById: userId, status: "mutual" },
      data: { status: "open", acceptedById: null, offeredShiftId: null },
    });

    // Safety net so deleting their shifts below can't hit a foreign-key error:
    // any remaining request of any status (e.g. a historical "denied" one)
    // still pointing at one of their shifts loses that reference.
    if (shiftIds.length > 0) {
      await tx.swapRequest.deleteMany({ where: { shiftId: { in: shiftIds } } });
      await tx.swapRequest.updateMany({
        where: { offeredShiftId: { in: shiftIds } },
        data: { offeredShiftId: null },
      });
    }

    // Delete all their preferences (open ones, and the matched ones the
    // cycle-deny above already reset to open) and all their shifts.
    await tx.swapPreference.deleteMany({ where: { userId } });
    await tx.shift.deleteMany({ where: { ownerId: userId } });

    // If they were the group's only admin, someone has to hold the role —
    // hand it to whoever's been here longest.
    if (me?.role === "ADMIN") {
      const otherAdmins = await tx.user.count({ where: { groupId, role: "ADMIN", id: { not: userId } } });
      if (otherAdmins === 0) {
        const successor = await tx.user.findFirst({
          where: { groupId, id: { not: userId } },
          orderBy: { createdAt: "asc" },
        });
        if (successor) {
          await tx.user.update({ where: { id: successor.id }, data: { role: "ADMIN" } });
        }
      }
    }

    // Message history is left as-is — a harmless historical record, still
    // correctly scoped to the old group's groupId.
    await tx.user.update({ where: { id: userId }, data: { groupId: null, role: "MEMBER" } });
  });

  return NextResponse.json({ ok: true });
}
