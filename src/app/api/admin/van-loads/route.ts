import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import type { VanLoadWithUser } from "@/types/stock";

// Prevent static generation for this API route
export const dynamic = 'force-dynamic';

export const GET = withPermission('manage_van_stock', async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const userId = url.searchParams.get('userId');

    if (!date) {
      return Response.json({ error: "Date parameter is required" }, { status: 400 });
    }

    // Build where clause
    const whereClause: {
      userId?: string;
      date: {
        gte: Date;
        lt: Date;
      };
    } = {
      date: {
        gte: new Date(date + 'T00:00:00.000Z'),
        lt: new Date(date + 'T23:59:59.999Z')
      }
    };

    // If userId is specified, filter by user
    if (userId) {
      whereClause.userId = userId;
    }

    const vanLoads: VanLoadWithUser[] = await prisma.vanLoad.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            username: true
          }
        }
      },
      orderBy: [
        { userId: 'asc' },
        { itemName: 'asc' }
      ]
    });

    return Response.json(vanLoads);

  } catch (err) {
    console.error("[GET /api/admin/van-loads]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});