import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import type { SaleWithUser } from "@/types/stock";

// Prevent static generation for this API route
export const dynamic = 'force-dynamic';

type RecentSale = {
  id: string;
  billNumber: string;
  billTitle: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  createdAt: Date;
};

export const GET = withPermission('view_all_sales', async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Build date filter
    const dateFilter: {
      gte?: Date;
      lte?: Date;
    } = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Get all sales with user information
    const sales: SaleWithUser[] = await prisma.sale.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Group sales by user
    const userSalesMap = new Map();
    const billsMap = new Map(); // Track unique bills per user

    sales.forEach((sale: SaleWithUser) => {
      const userId = sale.user.id;
      const username = sale.user.username;
      const billKey = `${userId}-${sale.billNumber}`;

      if (!userSalesMap.has(userId)) {
        userSalesMap.set(userId, {
          userId,
          username,
          totalSales: 0,
          totalAmount: 0,
          totalBills: 0,
          paymentMethods: {
            cash: 0,
            cheque: 0,
            credit: 0
          },
          recentSales: []
        });
      }

      const userData = userSalesMap.get(userId);
      userData.totalSales += 1;
      userData.totalAmount += sale.totalAmount;
      userData.paymentMethods[sale.paymentMethod] = 
        (userData.paymentMethods[sale.paymentMethod] || 0) + sale.totalAmount;
      
      // Add to recent sales (we'll limit this later)
      userData.recentSales.push({
        id: sale.id,
        billNumber: sale.billNumber,
        billTitle: sale.billTitle,
        itemName: sale.itemName,
        quantity: sale.quantity,
        unitPrice: sale.unitPrice,
        totalAmount: sale.totalAmount,
        paymentMethod: sale.paymentMethod,
        createdAt: sale.createdAt
      });

      // Track unique bills
      if (!billsMap.has(billKey)) {
        billsMap.set(billKey, userId);
        userData.totalBills += 1;
      }
    });

    // Process the data
    const userSalesData = Array.from(userSalesMap.values()).map(userData => {
      // Calculate average bill value
      userData.averageBillValue = userData.totalBills > 0 ? 
        userData.totalAmount / userData.totalBills : 0;
      
      // Limit recent sales to 5 most recent
      userData.recentSales = userData.recentSales
        .sort((a: RecentSale, b: RecentSale) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      
      return userData;
    });

    // Sort by total amount (highest first)
    userSalesData.sort((a, b) => b.totalAmount - a.totalAmount);

    // Calculate overall statistics
    const totalRevenue = sales.reduce((sum: number, sale: SaleWithUser) => sum + sale.totalAmount, 0);
    const totalSalesCount = sales.length;
    const totalUsers = userSalesData.length;
    const averagePerUser = totalUsers > 0 ? totalRevenue / totalUsers : 0;

    return Response.json({
      userSalesData,
      summary: {
        totalRevenue,
        totalSalesCount,
        totalUsers,
        averagePerUser
      }
    });

  } catch (err) {
    console.error("[GET /api/admin/user-sales]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});