import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

// PATCH /api/groups/members/:userId/role  { role: "ADMIN" | "MEMBER" }
// Caller must be an admin in the same group as the target. Role is read fresh
// from the DB rather than the session, since a stale cached role would be
// wrong in exactly the scenario this route exists for.
export async function PATCH(req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const callerId = (session.user as any).id;
  const groupId = (session.user as any).groupId;
  if (!groupId) return NextResponse.json({ error: "join a group first" }, { status: 403 });

  const { role } = await req.json();
  if (role !== "ADMIN" && role !== "MEMBER") {
    return NextResponse.json({ error: "role must be ADMIN or MEMBER" }, { status: 400 });
  }

  const caller = await db.user.findUnique({ where: { id: callerId } });
  if (!caller || caller.groupId !== groupId || caller.role !== "ADMIN") {
    return NextResponse.json({ error: "only an admin can change roles" }, { status: 403 });
  }

  const target = await db.user.findUnique({ where: { id: params.userId } });
  if (!target || target.groupId !== groupId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (target.id === callerId && role === "MEMBER") {
    const otherAdmins = await db.user.count({ where: { groupId, role: "ADMIN", id: { not: callerId } } });
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "You're the only admin — promote someone else first." },
        { status: 409 },
      );
    }
  }

  const updated = await db.user.update({
    where: { id: target.id },
    data: { role },
    select: { id: true, name: true, role: true, createdAt: true },
  });

  if (role === "ADMIN") {
    await notify({
      userId: target.id,
      groupId,
      type: "role_changed",
      title: "You're now an admin",
      body: "You've been promoted to admin for your group.",
      href: "/dashboard",
    });
  }

  return NextResponse.json(updated);
}
