import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { username } = await request.json();

  if (!username) {
    return Response.json({ error: "Username required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase().trim() },
    select: { email: true },
  });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json({ email: user.email });
}
