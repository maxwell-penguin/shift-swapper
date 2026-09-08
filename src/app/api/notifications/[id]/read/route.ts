import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH /api/notifications/:id/read
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const notification = await db.notification.findUnique({ where: { id: params.id } });
  if (!notification || notification.userId !== userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updated = await db.notification.update({ where: { id: params.id }, data: { read: true } });
  return NextResponse.json(updated);
}
