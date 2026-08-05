import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { slugify } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const usersData = body.users;

    if (!Array.isArray(usersData) || usersData.length === 0) {
      return NextResponse.json(
        { error: "Data users tidak valid atau kosong" },
        { status: 400 }
      );
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Proses berurutan untuk menghindari race condition saat pembuatan tenant
    for (const [index, item] of usersData.entries()) {
      try {
        const { name, email, password, role, tenantName, status } = item;

        if (!name || !email || !password) {
          throw new Error("Data name, email, dan password wajib diisi");
        }

        // Cek duplikasi email
        const existing = await prisma.user.findUnique({
          where: { email: String(email).toLowerCase() },
        });

        if (existing) {
          throw new Error(`Email ${email} sudah terdaftar`);
        }

        const passwordHash = await bcrypt.hash(String(password), 12);
        let assignedTenantId: string | null = null;

        // Jika ada nama tenant, buat atau cari tenant
        if (tenantName && String(tenantName).trim()) {
          const tName = String(tenantName).trim();
          let tenant = await prisma.tenant.findFirst({
            where: { name: { equals: tName, mode: "insensitive" } },
          });

          if (!tenant) {
            tenant = await prisma.tenant.create({
              data: {
                name: tName,
                slug: slugify(tName) + "-" + Date.now().toString(36),
              },
            });
          }
          assignedTenantId = tenant.id;
        }

        await prisma.user.create({
          data: {
            name: String(name),
            email: String(email).toLowerCase(),
            passwordHash,
            role: role === "SUPERADMIN" ? "SUPERADMIN" : "MERCHANT",
            status: status === "SUSPENDED" || status === "BLOCKED" ? status : "ACTIVE",
            tenantId: assignedTenantId,
          },
        });

        successCount++;
      } catch (err: any) {
        failedCount++;
        errors.push(`Baris ${index + 2}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: usersData.length,
        success: successCount,
        failed: failedCount,
      },
      errors,
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat import" },
      { status: 500 }
    );
  }
}
