import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const page = parseInt(params.get("page") || "1");
  const perPage = parseInt(params.get("per_page") || "20");
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

  const [transactions, total, statsRaw, filteredStats] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { tenant: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { ...where, status: "PAID" },
      _sum: { amount: true, amountReceived: true, platformFee: true },
    }),
  ]);

  const paidCount = await prisma.transaction.count({
    where: { status: "PAID" },
  });
  const pendingCount = await prisma.transaction.count({
    where: { status: "PENDING" },
  });

  const revenueStats = await prisma.transaction.aggregate({
    _sum: { platformFee: true, amount: true },
    where: { status: "PAID" },
  });

  const totalVolume = Number(revenueStats._sum.amount || 0);
  const totalPlatformFee = Number(revenueStats._sum.platformFee || 0);
  const successRate =
    statsRaw._count > 0 ? (paidCount / statsRaw._count) * 100 : 0;

  return NextResponse.json({
    transactions,
    totalPages: Math.ceil(total / perPage),
    total,
    stats: {
      totalVolume,
      totalPlatformFee,
      totalTransactions: statsRaw._count,
      successRate,
      pendingCount,
    },
    filteredTotal: {
      amount: Number(filteredStats._sum.amount || 0),
      amountReceived: Number(filteredStats._sum.amountReceived || 0),
      platformFee: Number(filteredStats._sum.platformFee || 0),
    }
  });
}
