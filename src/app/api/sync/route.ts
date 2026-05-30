/**
 * Sync API Endpoints
 * 
 * This module provides API endpoints for handling sync operations,
 * batch processing, and conflict resolution.
 */

import { NextRequest } from "next/server";
import { withAuth } from "../../../lib/api-auth";
import prisma from "../../../lib/prisma";
import { SyncOperation } from "../../../types/pwa";

// Prevent static generation for this API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/sync - Get sync status and pending operations
 */
export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "status") {
      // Get sync status for the user
      const pendingOperations = await prisma.syncOperation.count({
        where: {
          userId: user.id,
          status: "pending"
        }
      });

      const failedOperations = await prisma.syncOperation.count({
        where: {
          userId: user.id,
          status: "failed"
        }
      });

      const lastSyncOperation = await prisma.syncOperation.findFirst({
        where: {
          userId: user.id,
          status: "completed"
        },
        orderBy: {
          completedAt: "desc"
        }
      });

      return Response.json({
        pendingOperations,
        failedOperations,
        lastSyncTime: lastSyncOperation?.completedAt || null,
        isOnline: true // Server-side, so always online
      });
    }

    if (action === "pending") {
      // Get pending sync operations for the user
      const operations = await prisma.syncOperation.findMany({
        where: {
          userId: user.id,
          status: "pending"
        },
        orderBy: {
          createdAt: "asc"
        }
      });

      return Response.json(operations);
    }

    return Response.json({ error: "Invalid action parameter" }, { status: 400 });
  } catch (error) {
    console.error("[GET /api/sync]", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
});

/**
 * POST /api/sync - Process sync operations
 */
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const { operations, action } = body as {
      operations?: SyncOperation[];
      action?: string;
    };

    if (action === "batch") {
      // Process batch of sync operations
      if (!operations || !Array.isArray(operations)) {
        return Response.json({ error: "Operations array is required for batch sync" }, { status: 400 });
      }

      const results = [];
      
      for (const operation of operations) {
        try {
          const result = await processSyncOperation(operation, user.id);
          results.push(result);
        } catch (error) {
          results.push({
            operationId: operation.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date()
          });
        }
      }

      return Response.json({ results });
    }

    if (action === "single") {
      // Process single sync operation
      const operation = body as SyncOperation;
      if (!operation) {
        return Response.json({ error: "Operation is required" }, { status: 400 });
      }

      const result = await processSyncOperation(operation, user.id);
      return Response.json(result);
    }

    return Response.json({ error: "Invalid action parameter" }, { status: 400 });
  } catch (error) {
    console.error("[POST /api/sync]", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
});

/**
 * PUT /api/sync - Update sync operation status or resolve conflicts
 */
export const PUT = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const { operationId, status, resolution, action } = body as {
      operationId: string;
      status?: string;
      resolution?: any;
      action?: string;
    };

    if (action === "resolve-conflict") {
      // Resolve a sync conflict
      const operation = await prisma.syncOperation.findFirst({
        where: {
          id: operationId,
          userId: user.id,
          status: "failed"
        }
      });

      if (!operation) {
        return Response.json({ error: "Operation not found or not in failed state" }, { status: 404 });
      }

      // Update operation with resolved data
      const updatedOperation = await prisma.syncOperation.update({
        where: { id: operationId },
        data: {
          data: resolution,
          status: "pending",
          retryCount: 0,
          error: null
        }
      });

      // Try to process the resolved operation
      try {
        const result = await processSyncOperation(updatedOperation as any, user.id);
        return Response.json(result);
      } catch (error) {
        return Response.json({
          operationId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    }

    if (action === "update-status") {
      // Update operation status
      const updated = await prisma.syncOperation.update({
        where: {
          id: operationId,
          userId: user.id
        },
        data: {
          status,
          completedAt: status === "completed" ? new Date() : null
        }
      });

      return Response.json(updated);
    }

    return Response.json({ error: "Invalid action parameter" }, { status: 400 });
  } catch (error) {
    console.error("[PUT /api/sync]", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
});

/**
 * DELETE /api/sync - Clear completed or failed sync operations
 */
export const DELETE = withAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    if (!status) {
      return Response.json({ error: "Status parameter is required" }, { status: 400 });
    }

    const deleted = await prisma.syncOperation.deleteMany({
      where: {
        userId: user.id,
        status: status
      }
    });

    return Response.json({ deletedCount: deleted.count });
  } catch (error) {
    console.error("[DELETE /api/sync]", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
});

/**
 * Process a single sync operation
 */
async function processSyncOperation(operation: SyncOperation, userId: string) {
  const startTime = Date.now();
  
  try {
    // Record the sync operation in the database
    const syncOp = await prisma.syncOperation.upsert({
      where: { id: operation.id },
      create: {
        id: operation.id,
        type: operation.type,
        endpoint: operation.endpoint,
        data: operation.data,
        userId: userId,
        status: "pending",
        retryCount: operation.retryCount || 0,
        maxRetries: operation.maxRetries || 3
      },
      update: {
        retryCount: operation.retryCount || 0,
        status: "pending"
      }
    });

    // Process the operation based on endpoint and type
    let result;
    
    if (operation.endpoint.includes('/van-load')) {
      result = await processSyncVanLoad(operation, userId);
    } else if (operation.endpoint.includes('/sales')) {
      result = await processSyncSale(operation, userId);
    } else if (operation.endpoint.includes('/bill-submissions')) {
      result = await processSyncBillSubmission(operation, userId);
    } else {
      throw new Error(`Unsupported sync endpoint: ${operation.endpoint}`);
    }

    // Update sync operation status
    await prisma.syncOperation.update({
      where: { id: operation.id },
      data: {
        status: "completed",
        completedAt: new Date()
      }
    });

    return {
      operationId: operation.id,
      success: true,
      data: result,
      timestamp: new Date()
    };
  } catch (error) {
    // Update sync operation with error
    await prisma.syncOperation.update({
      where: { id: operation.id },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        retryCount: (operation.retryCount || 0) + 1
      }
    });

    throw error;
  }
}

/**
 * Process van load sync operation
 */
async function processSyncVanLoad(operation: SyncOperation, userId: string) {
  const data = operation.data;
  
  switch (operation.type) {
    case 'CREATE':
      // Check for conflicts (existing van load for same user, date, and item)
      const existing = await prisma.vanLoad.findFirst({
        where: {
          userId: userId,
          date: new Date(data.date),
          itemName: data.itemName
        }
      });

      if (existing) {
        // Conflict detected - merge or update
        const updated = await prisma.vanLoad.update({
          where: { id: existing.id },
          data: {
            loaded: data.loaded,
            returned: data.returned,
            syncStatus: "synced"
          }
        });
        return updated;
      } else {
        // Create new van load
        const created = await prisma.vanLoad.create({
          data: {
            userId: userId,
            date: new Date(data.date),
            itemName: data.itemName,
            loaded: data.loaded,
            returned: data.returned || 0,
            syncStatus: "synced"
          }
        });
        return created;
      }

    case 'UPDATE':
      const updated = await prisma.vanLoad.update({
        where: { id: data.id },
        data: {
          loaded: data.loaded,
          returned: data.returned,
          syncStatus: "synced"
        }
      });
      return updated;

    case 'DELETE':
      const deleted = await prisma.vanLoad.delete({
        where: { id: data.id }
      });
      return deleted;

    default:
      throw new Error(`Unsupported van load operation type: ${operation.type}`);
  }
}

/**
 * Process sale sync operation
 */
async function processSyncSale(operation: SyncOperation, userId: string) {
  const data = operation.data;
  
  switch (operation.type) {
    case 'CREATE':
      const created = await prisma.sale.create({
        data: {
          userId: userId,
          billNumber: data.billNumber || "",
          itemName: data.itemName,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          totalAmount: data.totalAmount,
          paymentMethod: data.paymentMethod,
          billImageBase64: data.billImageBase64,
          billImageName: data.billImageName,
          syncStatus: "synced"
        }
      });
      return created;

    case 'UPDATE':
      const updated = await prisma.sale.update({
        where: { id: data.id },
        data: {
          billNumber: data.billNumber,
          itemName: data.itemName,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          totalAmount: data.totalAmount,
          paymentMethod: data.paymentMethod,
          billImageBase64: data.billImageBase64,
          billImageName: data.billImageName,
          syncStatus: "synced"
        }
      });
      return updated;

    case 'DELETE':
      const deleted = await prisma.sale.delete({
        where: { id: data.id }
      });
      return deleted;

    default:
      throw new Error(`Unsupported sale operation type: ${operation.type}`);
  }
}

/**
 * Process bill submission sync operation
 */
async function processSyncBillSubmission(operation: SyncOperation, userId: string) {
  const data = operation.data;
  
  switch (operation.type) {
    case 'CREATE':
      const created = await prisma.billSubmission.create({
        data: {
          userId: userId,
          billNumber: data.billNumber,
          imageData: data.imageData,
          imageName: data.imageName,
          selectedItems: data.selectedItems,
          processed: data.processed || false,
          syncStatus: "synced"
        }
      });
      return created;

    case 'UPDATE':
      const updated = await prisma.billSubmission.update({
        where: { id: data.id },
        data: {
          billNumber: data.billNumber,
          imageData: data.imageData,
          imageName: data.imageName,
          selectedItems: data.selectedItems,
          processed: data.processed,
          syncStatus: "synced"
        }
      });
      return updated;

    case 'DELETE':
      const deleted = await prisma.billSubmission.delete({
        where: { id: data.id }
      });
      return deleted;

    default:
      throw new Error(`Unsupported bill submission operation type: ${operation.type}`);
  }
}