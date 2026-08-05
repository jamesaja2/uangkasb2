import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymenkuClient } from "@/lib/paymenku";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trxId = req.nextUrl.searchParams.get("trx_id");
  if (!trxId) {
    return NextResponse.json({ error: "trx_id required" }, { status: 400 });
  }

  try {
    const client = await PaymenkuClient.fromTenant(
      session.user.tenantId || undefined
    );
    const result = await client.checkStatus(trxId);
    const data = result.data as Record<string, unknown>;

    // Update local DB
    if (data.status) {
      await prisma.transaction.updateMany({
        where: { trxId },
        data: {
          status: String(data.status).toUpperCase() as "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "FAILED" | "REFUNDED",
          paidAt: data.paid_at ? new Date(String(data.paid_at)) : undefined,
          totalFee: data.total_fee ? parseFloat(String(data.total_fee)) : undefined,
          amountReceived: data.amount_received
            ? parseFloat(String(data.amount_received))
            : undefined,
        },
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Gagal cek status",
      },
      { status: 500 }
    );
  }
}
