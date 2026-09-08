import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/groups/join  { name, inviteCode }
// Onboarding: attaches the caller to an existing group by its invite code,
// setting their display name in the same step.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const { name, inviteCode } = await req.json();
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const code = typeof inviteCode === "string" ? inviteCode.trim().toUpperCase() : "";
  if (!trimmedName || !code) {
    return NextResponse.json({ error: "name and inviteCode are required" }, { status: 400 });
  }

  const group = await db.group.findUnique({ where: { inviteCode: code } });
  if (!group) return NextResponse.json({ error: "No group found with that invite code." }, { status: 404 });

  await db.user.update({ where: { id: userId }, data: { name: trimmedName, groupId: group.id } });

  return NextResponse.json(group);
}
