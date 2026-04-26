import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";

interface StockReconciliationItem {
  itemName: string;
  loaded: number;
  returned: number;
  expectedSold: number; // loaded - returned
  actualSold: number;   // from sales records
  difference: number;   // expectedSold - actualSold
}

interface StockReconciliationResult {
  date: string;
  userId: string;
  username: string;
  items: StockReconciliationItem[];
  summary: {
    totalLoaded: number;
    totalReturned: number;
    totalExpectedSold: number;
    totalActualSold: number;
    totalDifference: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
    
    const isAdmin = (session.user as { role?: string }).role === "admin";
    if (!isAdmin) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date"); // YYYY-MM-DD
    const userId = searchParams.get("userId");

    if (!date || !userId) {
      return Response.json({ error: "Date and userId are required" }, { status: 400 });
    }

    // Get date range for the specified day
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    // Get van loads for the day
    const vanLoads = await prisma.vanLoad.findMany({
      where: {
        userId,
        date: { gte: start, lte: end }
      },
      include: {
        user: { select: { username: true, name: true } }
      }
    });

    if (vanLoads.length === 0) {
      return Response.json({ 
        error: "No van load data found for the specified date and user" 
      }, { status: 404 });
    }

    // Get sales for the same day
    const sales = await prisma.sale.findMany({
      where: {
        userId,
        createdAt: { gte: start, lte: end }
      }
    });

    // Group sales by item name and sum quantities
    const salesByItem = sales.reduce((acc, sale) => {
      if (!acc[sale.itemName]) {
        acc[sale.itemName] = 0;
      }
      acc[sale.itemName] += sale.quantity;
      return acc;
    }, {} as Record<string, number>);

    // Calculate reconciliation for each item
    const items: StockReconciliationItem[] = vanLoads.map(load => {
      const expectedSold = load.loaded - load.returned;
      const actualSold = salesByItem[load.itemName] || 0;
      const difference = expectedSold - actualSold;

      return {
        itemName: load.itemName,
        loaded: load.loaded,
        returned: load.returned,
        expectedSold,
        actualSold,
        difference
      };
    });

    // Calculate summary totals
    const summary = items.reduce((acc, item) => ({
      totalLoaded: acc.totalLoaded + item.loaded,
      totalReturned: acc.totalReturned + item.returned,
      totalExpectedSold: acc.totalExpectedSold + item.expectedSold,
      totalActualSold: acc.totalActualSold + item.actualSold,
      totalDifference: acc.totalDifference + item.difference
    }), {
      totalLoaded: 0,
      totalReturned: 0,
      totalExpectedSold: 0,
      totalActualSold: 0,
      totalDifference: 0
    });

    const result: StockReconciliationResult = {
      date,
      userId,
      username: vanLoads[0].user.username,
      items,
      summary
    };

    return Response.json(result);
  } catch (err) {
    console.error("[GET /api/stock-reconciliation]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}