import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const params = req.nextUrl.searchParams;
  const page = parseInt(params.get("page") || "1");
  const perPage = parseInt(params.get("per_page") || "20");
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
    ];
  }
  if (status && status !== "all") {
    where.status = status as Prisma.EnumTransactionStatusFilter;
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({
    transactions,
    totalPages: Math.ceil(total / perPage),
    total,
  });
}
