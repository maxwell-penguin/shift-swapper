import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInviteCode } from "@/lib/invite-code";

// GET /api/groups -> your own group's info (name, invite code)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const groupId = (session.user as any).groupId;
  if (!groupId) return NextResponse.json({ error: "join a group first" }, { status: 403 });

  const group = await db.group.findUnique({ where: { id: groupId } });
  if (!group) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(group);
}

// POST /api/groups  { name, groupName }
// Onboarding: creates a brand-new group and attaches the caller to it as
// its first member, setting their display name in the same step.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).groupId) {
    return NextResponse.json(
      { error: "You're already in a group — leave it first from the Team page." },
      { status: 409 },
    );
  }
  const userId = (session.user as any).id;

  const { name, groupName } = await req.json();
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedGroupName = typeof groupName === "string" ? groupName.trim() : "";
  if (!trimmedName || !trimmedGroupName) {
    return NextResponse.json({ error: "name and groupName are required" }, { status: 400 });
  }

  let group;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      group = await db.group.create({
        data: { name: trimmedGroupName, inviteCode: generateInviteCode() },
      });
      break;
    } catch (e: any) {
      if (e.code === "P2002") continue; // invite code collision — try another
      throw e;
    }
  }
  if (!group) return NextResponse.json({ error: "couldn't generate a unique invite code" }, { status: 500 });

  await db.user.update({
    where: { id: userId },
    data: { name: trimmedName, groupId: group.id, role: "ADMIN" },
  });

  return NextResponse.json(group, { status: 201 });
}
