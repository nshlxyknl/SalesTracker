import { NextRequest } from "next/server";
import { withAdmin } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import type { VanLoadWithUser } from "@/types/stock";

// Prevent static generation for this API route
export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (request: NextRequest, user) => {
  try {
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

    const loads: VanLoadWithUser[] = await prisma.vanLoad.findMany({
      where,
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(loads);
  } catch (err) {
    console.error("[GET /api/van-load]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});

export const POST = withAdmin(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    
    const { userId, date, items } = body as {
      userId: string;
      date: string;
      items: { itemName: string; loaded: number; returned: number }[];
    };

    if (!userId || !date || !items?.length) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!prisma) {
      console.error("Prisma client is null/undefined");
      return Response.json({ error: "Database client not initialized" }, { status: 500 });
    }

    if (!prisma.vanLoad) {
      console.error("VanLoad model not found on Prisma client");
      return Response.json({ error: "VanLoad model not available" }, { status: 500 });
    }

    const loadDate = new Date(date);

    // Instead of deleting existing loads, we'll add new ones
    // This allows multiple assignments per day to accumulate
    const created = [];
    for (const item of items) {
      const load = await prisma.vanLoad.create({
        data: {
          userId,
          date: loadDate,
          itemName: item.itemName,
          loaded: item.loaded,
          returned: item.returned,
        },
      });
      created.push(load);
    }

    return Response.json(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/van-load] Error:", err);
    console.error("Error stack:", err instanceof Error ? err.stack : "No stack trace");
    return Response.json({ error: String(err) }, { status: 500 });
  }
});

export const PUT = withAdmin(async (request: NextRequest, user) => {
  try {
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
});