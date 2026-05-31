import { NextRequest } from "next/server";
import { withUserOrAdmin } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

// Prevent static generation for this API route
export const dynamic = 'force-dynamic';

export const GET = withUserOrAdmin(async (request: NextRequest, user) => {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Get user's van loads for the specified date
    const vanLoads = await prisma.vanLoad.findMany({
      where: {
        userId: user.id,
        date: {
          gte: new Date(date + 'T00:00:00.000Z'),
          lt: new Date(date + 'T23:59:59.999Z')
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get user's sales for the specified date to calculate remaining stock
    const sales = await prisma.sale.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: new Date(date + 'T00:00:00.000Z'),
          lt: new Date(date + 'T23:59:59.999Z')
        }
      }
    });

    // Calculate current stock by item
    const stockMap = new Map<string, {
      itemName: string;
      loaded: number;
      sold: number;
      remaining: number;
      returned: number;
    }>();

    // Add loaded quantities
    vanLoads.forEach(load => {
      const key = load.itemName;
      if (!stockMap.has(key)) {
        stockMap.set(key, {
          itemName: key,
          loaded: 0,
          sold: 0,
          remaining: 0,
          returned: load.returned
        });
      }
      const stock = stockMap.get(key)!;
      stock.loaded += load.loaded;
      stock.returned = load.returned; // Use the latest returned value
    });

    // Subtract sold quantities
    sales.forEach(sale => {
      const key = sale.itemName;
      if (!stockMap.has(key)) {
        stockMap.set(key, {
          itemName: key,
          loaded: 0,
          sold: 0,
          remaining: 0,
          returned: 0
        });
      }
      const stock = stockMap.get(key)!;
      stock.sold += sale.quantity;
    });

    // Calculate remaining stock
    const userStock = Array.from(stockMap.values()).map(stock => {
      stock.remaining = stock.loaded - stock.sold - stock.returned;
      return stock;
    });

    // Sort by item name
    userStock.sort((a, b) => a.itemName.localeCompare(b.itemName));

    return Response.json({
      date,
      stock: userStock,
      hasStock: userStock.length > 0,
      totalItems: userStock.reduce((sum, item) => sum + item.remaining, 0)
    });

  } catch (err) {
    console.error("[GET /api/user-stock]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});