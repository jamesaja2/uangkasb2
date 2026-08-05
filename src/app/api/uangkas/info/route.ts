import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUangKasBill } from "@/lib/uangkas";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let tenantId = session.user.tenantId;

  // Jika user belum punya tenant, kaitkan ke default tenant
  if (!tenantId) {
    const defaultTenant = await prisma.tenant.findFirst({
      where: { status: "ACTIVE" },
    });
    if (defaultTenant) {
      tenantId = defaultTenant.id;
    } else {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 400 });
    }
  }

  const billInfo = await getUangKasBill(tenantId);
  
  // Ambil juga riwayat pembayaran kas terakhir user
  const history = await prisma.transaction.findMany({
    where: {
      tenantId,
      channelCode: "QRIS",
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      trxId: true,
      referenceId: true,
      amount: true,
      totalFee: true,
      status: true,
      createdAt: true,
      paidAt: true,
      orderItems: true,
      payUrl: true,
    },
  });

  return NextResponse.json({
    user: {
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    },
    bill: billInfo,
    history,
  });
}
