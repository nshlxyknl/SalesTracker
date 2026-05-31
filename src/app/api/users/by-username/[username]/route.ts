import { NextRequest } from "next/server";
import { withAdmin } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

// Prevent static generation for this API route
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ username: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  // Handle authentication manually since withAdmin might not work with new App Router params
  const authResult = await import("@/lib/api-auth").then(auth => auth.requireAdmin(request));
  
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const { username } = await context.params;
    
    if (!username) {
      return Response.json({ error: "Username parameter is required" }, { status: 400 });
    }

    const decodedUsername = decodeURIComponent(username);

    const targetUser = await prisma.user.findUnique({
      where: { username: decodedUsername },
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
}