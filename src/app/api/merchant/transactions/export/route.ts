import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { formatDate, formatOrderItemsForCSV } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const params = req.nextUrl.searchParams;
  const search = params.get("search") || "";
  const status = params.get("status");

  const where: Prisma.TransactionWhereInput = {};
  if (tenantId) {
    where.tenantId = tenantId;
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
    orderBy: { createdAt: "desc" },
  });

  // Construct CSV
  const header = [
    "Trx ID",
    "Reference ID",
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
      "Content-Disposition": `attachment; filename="merchant_transactions_${Date.now()}.csv"`,
    },
  });
}
