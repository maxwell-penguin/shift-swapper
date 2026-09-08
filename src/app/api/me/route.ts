import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// PATCH /api/me  { name: "..." } — the caller renaming themselves only, no
// role/group fields here (those go through the dedicated admin routes).
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name } = await req.json();
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) return NextResponse.json({ error: "name required" }, { status: 400 });

  const updated = await db.user.update({
    where: { id: (session.user as any).id },
    data: { name: trimmed.slice(0, 100) },
    select: { id: true, name: true },
  });

  return NextResponse.json(updated);
}
