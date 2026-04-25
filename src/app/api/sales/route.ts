import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const isAdmin = (session.user as { role?: string }).role === "admin";
    const sales = await prisma.sale.findMany({
      where: isAdmin ? undefined : { userId: session.user.id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(sales);
  } catch (err) {
    console.error("[GET /api/sales]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const itemsJson = formData.get("items") as string;
    const paymentMethod = formData.get("paymentMethod") as string;
    const billFile = formData.get("billImage") as File | null;

    if (!itemsJson || !paymentMethod) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const items: { itemName: string; quantity: number; unitPrice: number }[] = JSON.parse(itemsJson);
    if (!items.length) return Response.json({ error: "No items provided" }, { status: 400 });

    let billImageBase64: string | null = null;
    let billImageName: string | null = null;
    if (billFile && billFile.size > 0) {
      const bytes = await billFile.arrayBuffer();
      billImageBase64 = `data:${billFile.type};base64,${Buffer.from(bytes).toString("base64")}`;
      billImageName = billFile.name;
    }

    // Count distinct bill numbers this user already has (outside transaction)
    const existing = await prisma.sale.findMany({
      where: { userId: session.user.id, NOT: { billNumber: "" } },
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
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalAmount: item.quantity * item.unitPrice,
          paymentMethod,
          billImageBase64,
          billImageName,
          userId: session.user.id,
        },
      });
      created.push(sale);
    }

    return Response.json(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/sales]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
