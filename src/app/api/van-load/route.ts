import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user as { role?: string }).role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date"); // YYYY-MM-DD
    const userId = searchParams.get("userId");

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    }

    const loads = await prisma.vanLoad.findMany({
      where,
      include: { user: { select: { username: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(loads);
  } catch (err) {
    console.error("[GET /api/van-load]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user as { role?: string }).role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, date, items } = body as {
      userId: string;
      date: string;
      items: { itemName: string; loaded: number; returned: number; unitPrice: number }[];
    };

    if (!userId || !date || !items?.length) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const loadDate = new Date(date);

    // Delete existing loads for this user+date before reinserting (upsert behaviour)
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    await prisma.vanLoad.deleteMany({
      where: { userId, date: { gte: start, lte: end } },
    });

    const created = [];
    for (const item of items) {
      const load = await prisma.vanLoad.create({
        data: {
          userId,
          date: loadDate,
          itemName: item.itemName,
          loaded: item.loaded,
          returned: item.returned,
          unitPrice: item.unitPrice,
        },
      });
      created.push(load);
    }

    return Response.json(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/van-load]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user as { role?: string }).role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, returned } = body as { id: string; returned: number };

    if (!id || returned === undefined) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const updated = await prisma.vanLoad.update({
      where: { id },
      data: { returned },
    });

    return Response.json(updated);
  } catch (err) {
    console.error("[PUT /api/van-load]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}