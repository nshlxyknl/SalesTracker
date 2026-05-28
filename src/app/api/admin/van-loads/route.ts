import { NextRequest } from "next/server";
import { withRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

// Prevent static generation for this API route
export const dynamic = 'force-dynamic';

export const GET = withRole('admin', async (request: NextRequest, user) => {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const date = url.searchParams.get('date');

    let whereClause: any = {};
    
    if (userId) {
      whereClause.userId = userId;
    }
    
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
      
      whereClause.date = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const vanLoads = await prisma.vanLoad.findMany({
      where: whereClause,
      include: { 
        user: { 
          select: { 
            id: true, 
            username: true 
          } 
        } 
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(vanLoads);
  } catch (err) {
    console.error("[GET /api/admin/van-loads]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withRole('admin', async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const { userId, date, items } = body;

    if (!userId || !date || !items || !Array.isArray(items)) {
      return Response.json({ 
        error: "Missing required fields: userId, date, items" 
      }, { status: 400 });
    }

    // Validate items structure
    for (const item of items) {
      if (!item.itemName || typeof item.loaded !== 'number') {
        return Response.json({ 
          error: "Each item must have itemName and loaded quantity" 
        }, { status: 400 });
      }
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return Response.json({ 
        error: "User not found" 
      }, { status: 404 });
    }

    const targetDate = new Date(date);
    
    // Delete existing van loads for this user and date
    await prisma.vanLoad.deleteMany({
      where: {
        userId,
        date: {
          gte: new Date(targetDate.setHours(0, 0, 0, 0)),
          lte: new Date(targetDate.setHours(23, 59, 59, 999)),
        }
      }
    });

    // Create new van loads
    const vanLoads = await Promise.all(
      items.map((item: any) =>
        prisma.vanLoad.create({
          data: {
            userId,
            date: new Date(date),
            itemName: item.itemName,
            loaded: item.loaded,
            returned: item.returned || 0,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
              }
            }
          }
        })
      )
    );

    return Response.json(vanLoads, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/van-loads]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const PUT = withRole('admin', async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const { id, returned } = body;

    if (!id || typeof returned !== 'number') {
      return Response.json({ 
        error: "Missing required fields: id, returned" 
      }, { status: 400 });
    }

    const vanLoad = await prisma.vanLoad.findUnique({
      where: { id }
    });

    if (!vanLoad) {
      return Response.json({ 
        error: "Van load not found" 
      }, { status: 404 });
    }

    if (returned > vanLoad.loaded) {
      return Response.json({ 
        error: "Returned quantity cannot exceed loaded quantity" 
      }, { status: 400 });
    }

    const updatedVanLoad = await prisma.vanLoad.update({
      where: { id },
      data: { returned },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          }
        }
      }
    });

    return Response.json(updatedVanLoad);
  } catch (err) {
    console.error("[PUT /api/admin/van-loads]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});