import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/messages -> the last 50 messages in the shared channel, oldest first
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const messages = await db.message.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true } } },
  });

  return NextResponse.json(messages.reverse());
}

// POST /api/messages  { body: "..." }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { body } = await req.json();
  const trimmed = typeof body === "string" ? body.trim() : "";
  if (!trimmed) return NextResponse.json({ error: "body required" }, { status: 400 });

  const message = await db.message.create({
    data: { authorId: (session.user as any).id, body: trimmed.slice(0, 2000) },
    include: { author: { select: { id: true, name: true } } },
  });

  return NextResponse.json(message, { status: 201 });
}
