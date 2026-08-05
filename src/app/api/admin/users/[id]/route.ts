import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAudit, getClientIp, getUserAgent } from "@/lib/audit";
import { UserRole, UserStatus } from "@prisma/client";

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await props.params;
  const body = await req.json();

  const updateData: Record<string, unknown> = {};

  if (body.name) updateData.name = body.name;
  if (body.email) updateData.email = body.email;
  if (body.role) updateData.role = body.role as UserRole;
  if (body.status) updateData.status = body.status as UserStatus;
  if (body.password) {
    updateData.passwordHash = await bcrypt.hash(body.password, 12);
  }

  // Handle tenant update
  if (body.tenantId !== undefined || body.tenantName) {
    let assignedTenantId = body.tenantId || null;
    if (!assignedTenantId && body.tenantName) {
      const { slugify } = await import("@/lib/utils");
      const tenant = await prisma.tenant.create({
        data: {
          name: body.tenantName,
          slug: slugify(body.tenantName) + "-" + Date.now().toString(36),
        },
      });
      assignedTenantId = tenant.id;
    }
    updateData.tenantId = assignedTenantId;
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  await logAudit({
    userId: session.user.id,
    userName: session.user.name || undefined,
    action: body.status ? "user.suspend" : "user.update",
    target: `user:${id}`,
    details: { changes: Object.keys(updateData) },
    ipAddress: getClientIp(req.headers),
    userAgent: getUserAgent(req.headers),
  });

  return NextResponse.json({ user: { id: user.id } });
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await props.params;

  await prisma.user.delete({ where: { id } });

  await logAudit({
    userId: session.user.id,
    userName: session.user.name || undefined,
    action: "user.delete",
    target: `user:${id}`,
    ipAddress: getClientIp(req.headers),
    userAgent: getUserAgent(req.headers),
  });

  return NextResponse.json({ success: true });
}
