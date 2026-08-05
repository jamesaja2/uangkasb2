import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAudit, getClientIp, getUserAgent } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { UserRole, UserStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.get("search") || "";

  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {},
    include: { tenant: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const tenantIds = Array.from(
    new Set(users.map((u) => u.tenantId).filter(Boolean))
  ) as string[];

  const tenantStats = await prisma.transaction.groupBy({
    by: ["tenantId"],
    where: { tenantId: { in: tenantIds } },
    _count: { id: true },
    _sum: { amount: true },
  });

  const statsMap = new Map(
    tenantStats.map((t) => [
      t.tenantId,
      { count: t._count.id, volume: Number(t._sum.amount || 0) },
    ])
  );

  const usersWithStats = users.map((user) => ({
    ...user,
    stats: user.tenantId
      ? statsMap.get(user.tenantId) || { count: 0, volume: 0 }
      : { count: 0, volume: 0 },
  }));

  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ users: usersWithStats, tenants });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, email, password, role, tenantName, tenantId, status } = body;

  // Check if email exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Email sudah terdaftar" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Create or find tenant
  let assignedTenantId = tenantId;
  if (!assignedTenantId && tenantName) {
    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        slug: slugify(tenantName) + "-" + Date.now().toString(36),
      },
    });
    assignedTenantId = tenant.id;
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: role as UserRole,
      status: (status as UserStatus) || "ACTIVE",
      tenantId: assignedTenantId || null,
    },
  });

  await logAudit({
    userId: session.user.id,
    userName: session.user.name || undefined,
    action: "user.create",
    target: `user:${user.id}`,
    details: { email, role, tenantName },
    ipAddress: getClientIp(req.headers),
    userAgent: getUserAgent(req.headers),
  });

  return NextResponse.json({ user: { id: user.id, email: user.email } });
}
