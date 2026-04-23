import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = (session.user as { role?: string }).role === "admin";
  const sales = await prisma.sale.findMany({
    where: isAdmin ? undefined : { userId: session.user.id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(sales);
}

export async function POST(request: NextRequest) {
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

  if (!items.length) {
    return Response.json({ error: "No items provided" }, { status: 400 });
  }

  let billImageBase64: string | null = null;
  let billImageName: string | null = null;

  if (billFile && billFile.size > 0) {
    const bytes = await billFile.arrayBuffer();
    billImageBase64 = `data:${billFile.type};base64,${Buffer.from(bytes).toString("base64")}`;
    billImageName = billFile.name;
  }

  // Create all line items in a single transaction
  const created = await prisma.$transaction(
    items.map((item) =>
      prisma.sale.create({
        data: {
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalAmount: item.quantity * item.unitPrice,
          paymentMethod,
          billImageBase64,
          billImageName,
          userId: session.user.id,
        },
      })
    )
  );

  return Response.json(created, { status: 201 });
}
