import { NextRequest } from "next/server";
import { withPermission, withUserOrAdmin, requireOwnershipOrAdmin } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import type { SaleQuantity, VanLoadStock } from "@/types/stock";
import { validateSaleItems } from "@/lib/offline-sales";

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
    const whereClause: {
      userId?: string;
      createdAt?: {
        gte: Date;
        lt: Date;
      };
    } = isAdmin && !userId ? {} : { userId: targetUserId };

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

    const itemValidationError = validateSaleItems(items);
    if (itemValidationError) {
      return Response.json({ error: itemValidationError }, { status: 400 });
    }

    // Check stock availability for each item
    const today = new Date().toISOString().split('T')[0];
    const userStock: VanLoadStock[] = await prisma.vanLoad.findMany({
      where: {
        userId: user.id,
        date: {
          gte: new Date(today + 'T00:00:00.000Z'),
          lt: new Date(today + 'T23:59:59.999Z')
        }
      }
    });

    // Get today's sales to calculate current stock
    const todaySales: SaleQuantity[] = await prisma.sale.findMany({
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
    userStock.forEach((load) => {
      const key = load.itemName;
      stockMap.set(key, (stockMap.get(key) || 0) + load.loaded - load.returned);
    });

    // Subtract already sold quantities
    todaySales.forEach((sale) => {
      const key = sale.itemName;
      stockMap.set(key, (stockMap.get(key) || 0) - sale.quantity);
    });

    // Validate stock availability
    const requestedQuantities = new Map<string, number>();
    for (const item of items) {
      requestedQuantities.set(item.itemName, (requestedQuantities.get(item.itemName) || 0) + item.quantity);
    }

    for (const [itemName, totalRequested] of requestedQuantities.entries()) {
      const availableStock = stockMap.get(itemName) || 0;
      if (availableStock < totalRequested) {
        return Response.json({ 
          error: `Insufficient stock for ${itemName}. Available: ${availableStock}, Requested: ${totalRequested}` 
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

    // Increment user's bill counter and generate bill number
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { billCounter: { increment: 1 } },
      select: { billCounter: true, username: true }
    });
    
    // Create user-specific bill number format: USERNAME-NUMBER
    const userPrefix = updatedUser.username.substring(0, 2).toUpperCase();
    const billNumber = `${userPrefix}-${updatedUser.billCounter}`;

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
