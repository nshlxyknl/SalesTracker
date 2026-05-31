import { NextRequest } from "next/server";
import { withAdmin } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

// Prevent static generation for this API route
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  // Handle authentication manually since withAdmin might not work with new App Router params
  const authResult = await import("@/lib/api-auth").then(auth => auth.requireAdmin(request));
  
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const { userId } = await context.params;

    if (!userId) {
      return Response.json({ error: "User ID parameter is required" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
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
    console.error("[GET /api/users/[userId]]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}