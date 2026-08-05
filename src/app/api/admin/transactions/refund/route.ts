import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PaymenkuClient } from "@/lib/paymenku";
import { prisma } from "@/lib/prisma";
import { logAudit, getClientIp, getUserAgent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { trx_id, refund_amount, reason } = body;

    const trx = await prisma.transaction.findFirst({
      where: { trxId: trx_id },
      select: { tenantId: true },
    });

    if (!trx) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    const client = await PaymenkuClient.fromTenant(
      trx.tenantId || undefined
    );
    const result = await client.refundTransaction({
      trx_id,
      refund_amount,
      reason,
    });

    // Update local DB
    await prisma.transaction.updateMany({
      where: { trxId: trx_id },
      data: { status: "REFUNDED" },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name || undefined,
      action: "transaction.refund",
      target: `transaction:${trx_id}`,
      details: { refund_amount, reason },
      ipAddress: getClientIp(req.headers),
      userAgent: getUserAgent(req.headers),
    });

    return NextResponse.json(result.data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal refund transaksi",
      },
      { status: 500 }
    );
  }
}
