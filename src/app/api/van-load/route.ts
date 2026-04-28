import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PrismaClient } from "@prisma/client";

// Try direct import
const prisma = new PrismaClient();

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
    console.log("POST /api/van-load - Starting request");
    
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user as { role?: string }).role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log("Authentication successful");

    const body = await request.json();
    console.log("Request body:", body);
    
    const { userId, date, items } = body as {
      userId: string;
      date: string;
      items: { itemName: string; loaded: number; returned: number }[];
    };

    if (!userId || !date || !items?.length) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log("Validation passed, checking Prisma client...");
    console.log("Prisma client:", typeof prisma);
    console.log("Prisma vanLoad:", typeof prisma?.vanLoad);

    if (!prisma) {
      console.error("Prisma client is null/undefined");
      return Response.json({ error: "Database client not initialized" }, { status: 500 });
    }

    if (!prisma.vanLoad) {
      console.error("VanLoad model not found on Prisma client");
      return Response.json({ error: "VanLoad model not available" }, { status: 500 });
    }

    const loadDate = new Date(date);

    // Delete existing loads for this user+date before reinserting (upsert behaviour)
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    
    console.log("Attempting to delete existing loads...");
    await prisma.vanLoad.deleteMany({
      where: { userId, date: { gte: start, lte: end } },
    });
    console.log("Delete successful");

    const created = [];
    console.log("Creating new loads...");
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
    console.log("Created loads:", created.length);

    return Response.json(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/van-load] Error:", err);
    console.error("Error stack:", err instanceof Error ? err.stack : "No stack trace");
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