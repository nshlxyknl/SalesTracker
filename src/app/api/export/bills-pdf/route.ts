import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import jsPDF from "jspdf";
import "jspdf-autotable";

// Extend jsPDF type to include autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
    
    const isAdmin = (session.user as { role?: string }).role === "admin";
    if (!isAdmin) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("type") || "summary"; // summary, detailed, bills
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const userId = searchParams.get("userId");

    // Build where clause
    const where: any = {};
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Fetch sales data
    const sales = await prisma.sale.findMany({
      where,
      include: {
        user: { select: { username: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const pdfBuffer = await generatePDFReport(sales, reportType, { startDate, endDate, userId });
    
    const filename = `sales-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });

  } catch (err) {
    console.error("[GET /api/export/bills-pdf]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

async function generatePDFReport(sales: any[], reportType: string, filters: any) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text("Sales Report", 20, 20);
  
  doc.setFontSize(12);
  doc.text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, 20, 35);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 45);
  
  if (filters.startDate || filters.endDate) {
    const dateRange = `${filters.startDate || 'Beginning'} to ${filters.endDate || 'Present'}`;
    doc.text(`Date Range: ${dateRange}`, 20, 55);
  }

  // Summary Statistics
  const totalAmount = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const uniqueBills = new Set(sales.map(sale => sale.billNumber)).size;
  const uniqueUsers = new Set(sales.map(sale => sale.userId)).size;
  
  let yPosition = filters.startDate || filters.endDate ? 70 : 60;
  
  doc.setFontSize(14);
  doc.text("Summary", 20, yPosition);
  yPosition += 10;
  
  doc.setFontSize(10);
  doc.text(`Total Records: ${sales.length}`, 20, yPosition);
  doc.text(`Total Amount: $${(totalAmount / 100).toFixed(2)}`, 120, yPosition);
  yPosition += 10;
  doc.text(`Unique Bills: ${uniqueBills}`, 20, yPosition);
  doc.text(`Active Users: ${uniqueUsers}`, 120, yPosition);
  yPosition += 20;

  if (reportType === "summary") {
    // User-wise summary
    const userSummary = new Map();
    sales.forEach(sale => {
      if (!userSummary.has(sale.userId)) {
        userSummary.set(sale.userId, {
          username: sale.user.username,
          totalSales: 0,
          totalAmount: 0,
          billCount: new Set()
        });
      }
      const summary = userSummary.get(sale.userId);
      summary.totalSales += sale.quantity;
      summary.totalAmount += sale.totalAmount;
      summary.billCount.add(sale.billNumber);
    });

    const userTableData = Array.from(userSummary.values()).map(user => [
      user.username,
      user.totalSales.toString(),
      user.billCount.size.toString(),
      `$${(user.totalAmount / 100).toFixed(2)}`
    ]);

    doc.autoTable({
      head: [["User", "Total Items Sold", "Bills Count", "Total Amount"]],
      body: userTableData,
      startY: yPosition,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [200, 200, 200] }
    });

  } else if (reportType === "detailed") {
    // Detailed sales table
    const tableData = sales.map(sale => [
      sale.billNumber || "N/A",
      new Date(sale.createdAt).toLocaleDateString(),
      sale.user.username,
      sale.itemName,
      sale.quantity.toString(),
      `$${(sale.unitPrice / 100).toFixed(2)}`,
      `$${(sale.totalAmount / 100).toFixed(2)}`,
      sale.paymentMethod
    ]);

    doc.autoTable({
      head: [["Bill #", "Date", "User", "Item", "Qty", "Unit Price", "Total", "Payment"]],
      body: tableData,
      startY: yPosition,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [200, 200, 200] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30 },
        4: { cellWidth: 15 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
        7: { cellWidth: 25 }
      }
    });

  } else if (reportType === "bills") {
    // Bills summary
    const billsMap = new Map();
    sales.forEach(sale => {
      const billKey = `${sale.billNumber}-${sale.userId}`;
      if (!billsMap.has(billKey)) {
        billsMap.set(billKey, {
          billNumber: sale.billNumber,
          user: sale.user.username,
          date: sale.createdAt,
          paymentMethod: sale.paymentMethod,
          itemCount: 0,
          totalAmount: 0
        });
      }
      const bill = billsMap.get(billKey);
      bill.itemCount += 1;
      bill.totalAmount += sale.totalAmount;
    });

    const billTableData = Array.from(billsMap.values()).map(bill => [
      bill.billNumber || "N/A",
      new Date(bill.date).toLocaleDateString(),
      bill.user,
      bill.itemCount.toString(),
      `$${(bill.totalAmount / 100).toFixed(2)}`,
      bill.paymentMethod
    ]);

    doc.autoTable({
      head: [["Bill Number", "Date", "User", "Items", "Total Amount", "Payment Method"]],
      body: billTableData,
      startY: yPosition,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [200, 200, 200] }
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
  }

  return doc.output("arraybuffer");
}