import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// DELETE /api/swap-preferences/:id — withdraw your own preference from the market
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const pref = await db.swapPreference.findUnique({ where: { id: params.id } });
  if (!pref || pref.userId !== userId) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (pref.status !== "open") {
    return NextResponse.json(
      { error: "this preference is already part of a proposed trade — deny that trade first" },
      { status: 409 },
    );
  }

  await db.swapPreference.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
