import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const perPage = parseInt(req.nextUrl.searchParams.get("per_page") || "20");

  const where = tenantId ? { tenantId } : {};

  const [logs, total] = await Promise.all([
    prisma.webhookLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.webhookLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    totalPages: Math.ceil(total / perPage),
  });
}
