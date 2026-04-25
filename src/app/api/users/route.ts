import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user as { role?: string }).role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      where: { role: "user" },
      select: { id: true, username: true, name: true },
      orderBy: { username: "asc" },
    });

    return Response.json(users);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
