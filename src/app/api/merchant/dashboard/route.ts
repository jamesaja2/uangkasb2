import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({
      stats: {
        totalVolume: 0,
        totalTransactions: 0,
        successRate: 0,
        pendingCount: 0,
      },
      recentTransactions: [],
      chartData: [],
    });
  }

  // Stats
  const [statsRaw, paidCount, pendingCount, revenueStats] = await Promise.all([
    prisma.transaction.aggregate({
      where: { tenantId },
      _count: true,
    }),
    prisma.transaction.count({
      where: { tenantId, status: "PAID" },
    }),
    prisma.transaction.count({
      where: { tenantId, status: "PENDING" },
    }),
    prisma.transaction.aggregate({
      where: { tenantId, status: "PAID" },
      _sum: { amount: true },
    }),
  ]);

  const totalVolume = Number(revenueStats._sum.amount || 0);
  const successRate =
    statsRaw._count > 0 ? (paidCount / statsRaw._count) * 100 : 0;

  // Recent transactions
  const recentTransactions = await prisma.transaction.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      trxId: true,
      amount: true,
      status: true,
      channelCode: true,
      customerName: true,
      createdAt: true,
      orderItems: true,
    },
  });

  // Chart data (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const transactions = await prisma.transaction.findMany({
    where: {
      tenantId,
      createdAt: { gte: sevenDaysAgo },
      status: "PAID",
    },
    select: {
      amount: true,
      createdAt: true,
    },
  });

  // Group by date
  const chartMap: Record<string, { amount: number; count: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    chartMap[key] = { amount: 0, count: 0 };
  }

  for (const trx of transactions) {
    const key = trx.createdAt.toISOString().split("T")[0];
    if (chartMap[key]) {
      chartMap[key].amount += Number(trx.amount);
      chartMap[key].count += 1;
    }
  }

  const chartData = Object.entries(chartMap).map(([date, data]) => ({
    date: new Date(date).toLocaleDateString("id-ID", {
      month: "short",
      day: "numeric",
    }),
    amount: data.amount,
    count: data.count,
  }));

  return NextResponse.json({
    stats: {
      totalVolume,
      totalTransactions: statsRaw._count,
      successRate,
      pendingCount,
    },
    recentTransactions,
    chartData,
  });
}
