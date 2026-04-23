import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Admins see all sales; users see only their own
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
  const itemName = formData.get("itemName") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10);
  const unitPrice = parseFloat(formData.get("unitPrice") as string);
  const paymentMethod = formData.get("paymentMethod") as string;
  const billFile = formData.get("billImage") as File | null;

  if (!itemName || isNaN(quantity) || isNaN(unitPrice) || !paymentMethod) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  let billImageBase64: string | null = null;
  let billImageName: string | null = null;

  if (billFile && billFile.size > 0) {
    const bytes = await billFile.arrayBuffer();
    billImageBase64 = `data:${billFile.type};base64,${Buffer.from(bytes).toString("base64")}`;
    billImageName = billFile.name;
  }

  const sale = await prisma.sale.create({
    data: {
      itemName,
      quantity,
      unitPrice,
      totalAmount: quantity * unitPrice,
      paymentMethod,
      billImageBase64,
      billImageName,
      userId: session.user.id,
    },
  });

  return Response.json(sale, { status: 201 });
}
