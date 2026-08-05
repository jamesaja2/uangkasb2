import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymenkuClient } from "@/lib/paymenku";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { trxIds } = await req.json();

    if (!Array.isArray(trxIds) || trxIds.length === 0) {
      return NextResponse.json(
        { error: "trxIds tidak valid atau kosong" },
        { status: 400 }
      );
    }

    // Fetch transactions to know their tenantIds
    const transactions = await prisma.transaction.findMany({
      where: { trxId: { in: trxIds } },
      select: { trxId: true, tenantId: true },
    });

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: "Transaksi tidak ditemukan" },
        { status: 404 }
      );
    }

    let successCount = 0;
    let failedCount = 0;
    const results = [];

    // Map to cache PaymenkuClient per tenant to avoid unnecessary recreation
    const clientCache = new Map<string, PaymenkuClient>();

    for (const trx of transactions) {
      try {
        let client = clientCache.get(trx.tenantId);
        if (!client) {
          client = await PaymenkuClient.fromTenant(trx.tenantId);
          clientCache.set(trx.tenantId, client);
        }

        const result = await client.checkStatus(trx.trxId);
        const data = result.data as Record<string, unknown>;

        if (data.status) {
          await prisma.transaction.updateMany({
            where: { trxId: trx.trxId },
            data: {
              status: String(data.status).toUpperCase() as any,
              paidAt: data.paid_at ? new Date(String(data.paid_at)) : undefined,
              totalFee: data.total_fee ? parseFloat(String(data.total_fee)) : undefined,
              amountReceived: data.amount_received
                ? parseFloat(String(data.amount_received))
                : undefined,
            },
          });
          successCount++;
          results.push({ trxId: trx.trxId, status: data.status, success: true });
        } else {
          failedCount++;
          results.push({ trxId: trx.trxId, error: "Status tidak ditemukan", success: false });
        }
      } catch (error: any) {
        failedCount++;
        results.push({ trxId: trx.trxId, error: error.message, success: false });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: transactions.length,
        success: successCount,
        failed: failedCount,
      },
      results,
    });
  } catch (error) {
    console.error("Bulk check status error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat mengecek status massal" },
      { status: 500 }
    );
  }
}
