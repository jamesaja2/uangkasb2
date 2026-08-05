import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { formatDate, formatOrderItemsForCSV } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const search = params.get("search") || "";
  const status = params.get("status");
  const tenantId = params.get("tenantId");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");

  const where: Prisma.TransactionWhereInput = {};
  if (tenantId && tenantId !== "all") {
    where.tenantId = tenantId;
  }
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      where.createdAt.gte = from;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }
  if (search) {
    where.OR = [
      { trxId: { contains: search, mode: "insensitive" } },
      { referenceId: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerEmail: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status && status !== "all") {
    where.status = status as Prisma.EnumTransactionStatusFilter;
  }

  // Fetch all matching transactions (no pagination)
  const transactions = await prisma.transaction.findMany({
    where,
    include: { tenant: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const header = [
    "Trx ID",
    "Reference ID",
    "Tenant",
    "Customer Name",
    "Customer Email",
    "Channel",
    "Amount",
    "Status",
    "Nama Barang",
    "Harga Satuan",
    "Jumlah / Qty",
    "Subtotal Barang",
    "Detail Barang (Lengkap)",
    "Tanggal",
  ].join(",");

  const rows = transactions.map((trx) => {
    const itemCsv = formatOrderItemsForCSV(trx.orderItems, Number(trx.amount));
    return [
      trx.trxId,
      trx.referenceId,
      `"${trx.tenant?.name || ""}"`,
      `"${trx.customerName}"`,
      trx.customerEmail,
      trx.channelCode,
      trx.amount.toString(),
      trx.status,
      `"${itemCsv.names}"`,
      `"${itemCsv.prices}"`,
      `"${itemCsv.quantities}"`,
      `"${itemCsv.subtotals}"`,
      `"${itemCsv.details}"`,
      `"${formatDate(trx.createdAt.toISOString())}"`,
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions_${Date.now()}.csv"`,
    },
  });
}
