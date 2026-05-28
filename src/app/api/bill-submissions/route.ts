import { NextRequest } from "next/server";
import { withPermission, requireOwnershipOrAdmin } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

// Prevent static generation for this API route
export const dynamic = 'force-dynamic';

export const GET = withPermission('upload_bills', async (request: NextRequest, user) => {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    // If userId is specified, check ownership or admin access
    if (userId) {
      const ownershipResult = await requireOwnershipOrAdmin(request, userId);
      if (ownershipResult instanceof Response) {
        return ownershipResult;
      }
    }

    const isAdmin = user.role === "admin";
    const targetUserId = userId || user.id;

    const billSubmissions = await prisma.billSubmission.findMany({
      where: isAdmin && !userId ? undefined : { userId: targetUserId },
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

    return Response.json(billSubmissions);
  } catch (err) {
    console.error("[GET /api/bill-submissions]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withPermission('upload_bills', async (request: NextRequest, user) => {
  try {
    const formData = await request.formData();
    const billNumber = formData.get("billNumber") as string;
    const billFile = formData.get("billImage") as File;
    const selectedItemsJson = formData.get("selectedItems") as string;

    if (!billNumber || !billFile || !selectedItemsJson) {
      return Response.json({ 
        error: "Missing required fields: billNumber, billImage, selectedItems" 
      }, { status: 400 });
    }

    let selectedItems;
    try {
      selectedItems = JSON.parse(selectedItemsJson);
    } catch (error) {
      return Response.json({ 
        error: "Invalid selectedItems JSON" 
      }, { status: 400 });
    }

    if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
      return Response.json({ 
        error: "selectedItems must be a non-empty array" 
      }, { status: 400 });
    }

    // Validate selected items structure
    for (const item of selectedItems) {
      if (!item.itemName || typeof item.quantity !== 'number' || typeof item.unitPrice !== 'number') {
        return Response.json({ 
          error: "Each selected item must have itemName, quantity, and unitPrice" 
        }, { status: 400 });
      }
    }

    // Process bill image
    let imageData: string;
    let imageName: string;
    
    if (billFile.size > 10 * 1024 * 1024) { // 10MB limit
      return Response.json({ 
        error: "Bill image too large. Maximum size is 10MB" 
      }, { status: 400 });
    }

    const bytes = await billFile.arrayBuffer();
    imageData = `data:${billFile.type};base64,${Buffer.from(bytes).toString("base64")}`;
    imageName = billFile.name;

    // Check if bill number already exists for this user
    const existingBill = await prisma.billSubmission.findFirst({
      where: {
        userId: user.id,
        billNumber: billNumber.trim(),
      }
    });

    if (existingBill) {
      return Response.json({ 
        error: "A bill with this number already exists" 
      }, { status: 409 });
    }

    const billSubmission = await prisma.billSubmission.create({
      data: {
        userId: user.id,
        billNumber: billNumber.trim(),
        imageData,
        imageName,
        selectedItems,
        processed: false,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          }
        }
      }
    });

    return Response.json(billSubmission, { status: 201 });
  } catch (err) {
    console.error("[POST /api/bill-submissions]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const PUT = withPermission('view_bill_submissions', async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const { id, processed } = body;

    if (!id || typeof processed !== 'boolean') {
      return Response.json({ 
        error: "Missing required fields: id, processed" 
      }, { status: 400 });
    }

    // Check if bill submission exists
    const billSubmission = await prisma.billSubmission.findUnique({
      where: { id }
    });

    if (!billSubmission) {
      return Response.json({ 
        error: "Bill submission not found" 
      }, { status: 404 });
    }

    // Check ownership or admin access
    const ownershipResult = await requireOwnershipOrAdmin(request, billSubmission.userId);
    if (ownershipResult instanceof Response) {
      return ownershipResult;
    }

    const updatedBillSubmission = await prisma.billSubmission.update({
      where: { id },
      data: { processed },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          }
        }
      }
    });

    return Response.json(updatedBillSubmission);
  } catch (err) {
    console.error("[PUT /api/bill-submissions]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});