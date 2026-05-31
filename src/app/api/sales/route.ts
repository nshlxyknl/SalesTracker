import { NextRequest } from "next/server";
import { withPermission, withUserOrAdmin, requireOwnershipOrAdmin } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

// Prevent static generation for this API route
export const dynamic = 'force-dynamic';

export const GET = withUserOrAdmin(async (request: NextRequest, user) => {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const date = url.searchParams.get('date');

    // If userId is specified, check ownership or admin access
    if (userId) {
      const ownershipResult = await requireOwnershipOrAdmin(request, userId);
      if (ownershipResult instanceof Response) {
        return ownershipResult;
      }
    }

    const isAdmin = user.role === "admin";
    const targetUserId = userId || user.id;

    // Build where clause
    const whereClause: any = isAdmin && !userId ? {} : { userId: targetUserId };

    // Add date filter if provided
    if (date) {
      whereClause.createdAt = {
        gte: new Date(date + 'T00:00:00.000Z'),
        lt: new Date(date + 'T23:59:59.999Z')
      };
    }

    const sales = await prisma.sale.findMany({
      where: whereClause,
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(sales);
  } catch (err) {
    console.error("[GET /api/sales]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withUserOrAdmin(async (request: NextRequest, user) => {
  try {
    const formData = await request.formData();
    const billTitle = ((formData.get("billTitle") as string) || "").trim() || "Untitled Bill";
    const itemsJson = formData.get("items") as string;
    const paymentMethod = formData.get("paymentMethod") as string;
    const billFile = formData.get("billImage") as File | null;

    if (!itemsJson || !paymentMethod) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const items: { itemName: string; quantity: number; unitPrice: number }[] = JSON.parse(itemsJson);
    if (!items.length) return Response.json({ error: "No items provided" }, { status: 400 });

    // Check stock availability for each item
    const today = new Date().toISOString().split('T')[0];
    const userStock = await prisma.vanLoad.findMany({
      where: {
        userId: user.id,
        date: {
          gte: new Date(today + 'T00:00:00.000Z'),
          lt: new Date(today + 'T23:59:59.999Z')
        }
      }
    });

    // Get today's sales to calculate current stock
    const todaySales = await prisma.sale.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: new Date(today + 'T00:00:00.000Z'),
          lt: new Date(today + 'T23:59:59.999Z')
        }
      }
    });

    // Calculate current stock levels
    const stockMap = new Map<string, number>();
    userStock.forEach(load => {
      const key = load.itemName;
      stockMap.set(key, (stockMap.get(key) || 0) + load.loaded - load.returned);
    });

    // Subtract already sold quantities
    todaySales.forEach(sale => {
      const key = sale.itemName;
      stockMap.set(key, (stockMap.get(key) || 0) - sale.quantity);
    });

    // Validate stock availability
    for (const item of items) {
      const availableStock = stockMap.get(item.itemName) || 0;
      if (availableStock < item.quantity) {
        return Response.json({ 
          error: `Insufficient stock for ${item.itemName}. Available: ${availableStock}, Requested: ${item.quantity}` 
        }, { status: 400 });
      }
    }

    let billImageBase64: string | null = null;
    let billImageName: string | null = null;
    if (billFile && billFile.size > 0) {
      const bytes = await billFile.arrayBuffer();
      billImageBase64 = `data:${billFile.type};base64,${Buffer.from(bytes).toString("base64")}`;
      billImageName = billFile.name;
    }

    // Count distinct bill numbers this user already has (outside transaction)
    const existing = await prisma.sale.findMany({
      where: { userId: user.id, NOT: { billNumber: "" } },
      select: { billNumber: true },
    });
    const uniqueBills = new Set(existing.map((s) => s.billNumber));
    const billNumber = String(uniqueBills.size + 1);

    // Create all line items sequentially
    const created = [];
    for (const item of items) {
      const sale = await prisma.sale.create({
        data: {
          billNumber,
          billTitle,
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalAmount: item.quantity * item.unitPrice,
          paymentMethod,
          billImageBase64,
          billImageName,
          userId: user.id,
        },
      });
      created.push(sale);
    }

    return Response.json(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/sales]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
