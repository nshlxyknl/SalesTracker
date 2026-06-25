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
      items: { itemName: string; loaded: number; returned: number; casePrice?: number; schemeBottles?: number }[];
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
    const dateStr = loadDate.toISOString().split('T')[0];
    
    // Get previous day's closing stock (loaded - returned - sold)
    const previousDay = new Date(loadDate);
    previousDay.setDate(previousDay.getDate() - 1);
    const prevDateStr = previousDay.toISOString().split('T')[0];
    
    // Get previous day's van loads
    const prevVanLoads = await prisma.vanLoad.findMany({
      where: {
        userId,
        date: {
          gte: new Date(prevDateStr + 'T00:00:00.000Z'),
          lt: new Date(prevDateStr + 'T23:59:59.999Z')
        }
      }
    });
    
    // Get previous day's sales
    const prevSales = await prisma.sale.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(prevDateStr + 'T00:00:00.000Z'),
          lt: new Date(prevDateStr + 'T23:59:59.999Z')
        }
      }
    });
    
    // Calculate previous day's closing stock by item
    const prevClosingStock = new Map<string, number>();
    
    prevVanLoads.forEach(load => {
      const current = prevClosingStock.get(load.itemName) || 0;
      prevClosingStock.set(load.itemName, current + load.loaded - load.returned);
    });
    
    prevSales.forEach(sale => {
      const current = prevClosingStock.get(sale.itemName) || 0;
      prevClosingStock.set(sale.itemName, current - sale.quantity);
    });

    // Check if stock was already assigned for this date
    const existingLoads = await prisma.vanLoad.findMany({
      where: {
        userId,
        date: {
          gte: new Date(dateStr + 'T00:00:00.000Z'),
          lt: new Date(dateStr + 'T23:59:59.999Z')
        }
      }
    });
    
    if (existingLoads.length > 0) {
      // If stock already exists for today, this is an ADDITIONAL assignment (not opening stock)
      // Just add the new items
      const created = [];
      for (const item of items) {
        const load = await prisma.vanLoad.create({
          data: {
            userId,
            date: loadDate,
            itemName: item.itemName,
            loaded: item.loaded,
            returned: item.returned,
            casePrice: item.casePrice ?? 0,
            schemeBottles: item.schemeBottles ?? 0,
          },
        });
        created.push(load);
      }
      
      return Response.json({ 
        created,
        note: "Additional stock added to existing assignment"
      }, { status: 201 });
    }
    
    // First assignment of the day - include previous day's closing stock
    const created = [];
    const itemsWithCarryForward = new Map<string, {
      loaded: number;
      returned: number;
      casePrice: number;
      schemeBottles: number;
    }>();
    
    // Add new assignments to map
    items.forEach(item => {
      itemsWithCarryForward.set(item.itemName, {
        loaded: item.loaded,
        returned: item.returned,
        casePrice: item.casePrice ?? 0,
        schemeBottles: item.schemeBottles ?? 0
      });
    });
    
    // Add previous day's closing stock as opening stock for items not in new assignment
    prevClosingStock.forEach((closing, itemName) => {
      if (closing > 0 && !itemsWithCarryForward.has(itemName)) {
        // Item had stock yesterday but not assigned today - carry it forward
        itemsWithCarryForward.set(itemName, {
          loaded: closing,
          returned: 0,
          casePrice: 0,
          schemeBottles: 0
        });
      } else if (closing > 0 && itemsWithCarryForward.has(itemName)) {
        // Item has both previous stock AND new assignment - add them together
        const existing = itemsWithCarryForward.get(itemName)!;
        existing.loaded += closing;
      }
    });
    
    // Create van load records with cumulative stock
    for (const [itemName, data] of itemsWithCarryForward.entries()) {
      const load = await prisma.vanLoad.create({
        data: {
          userId,
          date: loadDate,
          itemName,
          loaded: data.loaded,
          returned: data.returned,
          casePrice: data.casePrice,
          schemeBottles: data.schemeBottles,
        },
      });
      created.push(load);
    }

    return Response.json({ 
      created,
      carriedForward: Array.from(prevClosingStock.entries()).map(([itemName, qty]) => ({ itemName, quantity: qty })),
      note: "Previous day's closing stock automatically carried forward"
    }, { status: 201 });
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