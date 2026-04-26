import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import ExcelJS from "exceljs";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
    
    const isAdmin = (session.user as { role?: string }).role === "admin";
    if (!isAdmin) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "excel"; // excel or csv
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

    if (format === "excel") {
      return await generateExcelExport(sales);
    } else {
      return await generateCSVExport(sales);
    }

  } catch (err) {
    console.error("[GET /api/export/bills]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

async function generateExcelExport(sales: any[]) {
  const workbook = new ExcelJS.Workbook();
  
  // Summary Sheet
  const summarySheet = workbook.addWorksheet("Summary");
  
  // Add title
  summarySheet.mergeCells("A1:H1");
  const titleCell = summarySheet.getCell("A1");
  titleCell.value = "Sales Export Report";
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: "center" };
  
  // Add export info
  summarySheet.getCell("A3").value = "Export Date:";
  summarySheet.getCell("B3").value = new Date().toLocaleDateString();
  summarySheet.getCell("A4").value = "Total Records:";
  summarySheet.getCell("B4").value = sales.length;
  
  // Calculate summary statistics
  const totalAmount = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const uniqueBills = new Set(sales.map(sale => sale.billNumber)).size;
  const uniqueUsers = new Set(sales.map(sale => sale.userId)).size;
  
  summarySheet.getCell("A5").value = "Total Amount:";
  summarySheet.getCell("B5").value = totalAmount / 100; // Convert from cents
  summarySheet.getCell("B5").numFmt = '"$"#,##0.00';
  
  summarySheet.getCell("A6").value = "Unique Bills:";
  summarySheet.getCell("B6").value = uniqueBills;
  
  summarySheet.getCell("A7").value = "Active Users:";
  summarySheet.getCell("B7").value = uniqueUsers;

  // Detailed Sales Sheet
  const detailSheet = workbook.addWorksheet("Detailed Sales");
  
  // Headers
  const headers = [
    "Bill Number", "Date", "Time", "User", "Item Name", 
    "Quantity", "Unit Price", "Total Amount", "Payment Method"
  ];
  
  detailSheet.addRow(headers);
  
  // Style headers
  const headerRow = detailSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" }
  };

  // Add data rows
  sales.forEach(sale => {
    const saleDate = new Date(sale.createdAt);
    detailSheet.addRow([
      sale.billNumber || "N/A",
      saleDate.toLocaleDateString(),
      saleDate.toLocaleTimeString(),
      sale.user.username,
      sale.itemName,
      sale.quantity,
      sale.unitPrice / 100, // Convert from cents
      sale.totalAmount / 100, // Convert from cents
      sale.paymentMethod
    ]);
  });

  // Format currency columns
  const unitPriceCol = detailSheet.getColumn(7);
  const totalAmountCol = detailSheet.getColumn(8);
  unitPriceCol.numFmt = '"$"#,##0.00';
  totalAmountCol.numFmt = '"$"#,##0.00';

  // Auto-fit columns
  detailSheet.columns.forEach(column => {
    column.width = 15;
  });

  // Bills Summary Sheet (grouped by bill)
  const billsSheet = workbook.addWorksheet("Bills Summary");
  
  // Group sales by bill number
  const billsMap = new Map();
  sales.forEach(sale => {
    const billKey = `${sale.billNumber}-${sale.userId}`;
    if (!billsMap.has(billKey)) {
      billsMap.set(billKey, {
        billNumber: sale.billNumber,
        user: sale.user.username,
        date: sale.createdAt,
        paymentMethod: sale.paymentMethod,
        items: [],
        totalAmount: 0
      });
    }
    const bill = billsMap.get(billKey);
    bill.items.push({
      itemName: sale.itemName,
      quantity: sale.quantity,
      unitPrice: sale.unitPrice,
      totalAmount: sale.totalAmount
    });
    bill.totalAmount += sale.totalAmount;
  });

  // Bills summary headers
  const billHeaders = [
    "Bill Number", "Date", "User", "Items Count", 
    "Total Amount", "Payment Method"
  ];
  billsSheet.addRow(billHeaders);
  
  // Style bills headers
  const billHeaderRow = billsSheet.getRow(1);
  billHeaderRow.font = { bold: true };
  billHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" }
  };

  // Add bills data
  Array.from(billsMap.values()).forEach(bill => {
    billsSheet.addRow([
      bill.billNumber || "N/A",
      new Date(bill.date).toLocaleDateString(),
      bill.user,
      bill.items.length,
      bill.totalAmount / 100,
      bill.paymentMethod
    ]);
  });

  // Format bills currency column
  const billTotalCol = billsSheet.getColumn(5);
  billTotalCol.numFmt = '"$"#,##0.00';

  // Auto-fit bills columns
  billsSheet.columns.forEach(column => {
    column.width = 15;
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  
  const filename = `sales-export-${new Date().toISOString().split('T')[0]}.xlsx`;
  
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

async function generateCSVExport(sales: any[]) {
  const headers = [
    "Bill Number", "Date", "Time", "User", "Item Name", 
    "Quantity", "Unit Price", "Total Amount", "Payment Method"
  ];
  
  let csv = headers.join(",") + "\n";
  
  sales.forEach(sale => {
    const saleDate = new Date(sale.createdAt);
    const row = [
      `"${sale.billNumber || "N/A"}"`,
      `"${saleDate.toLocaleDateString()}"`,
      `"${saleDate.toLocaleTimeString()}"`,
      `"${sale.user.username}"`,
      `"${sale.itemName}"`,
      sale.quantity,
      (sale.unitPrice / 100).toFixed(2),
      (sale.totalAmount / 100).toFixed(2),
      `"${sale.paymentMethod}"`
    ];
    csv += row.join(",") + "\n";
  });

  const filename = `sales-export-${new Date().toISOString().split('T')[0]}.csv`;
  
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}