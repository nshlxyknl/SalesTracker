import { NextRequest } from "next/server";
import { withAdmin } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

// Prevent static generation for this API route
export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (request: NextRequest, user, { params }) => {
  try {
    const username = decodeURIComponent(params.username as string);

    const targetUser = await prisma.user.findUnique({
      where: { username: username },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(targetUser);
  } catch (err) {
    console.error("[GET /api/users/by-username/[username]]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});