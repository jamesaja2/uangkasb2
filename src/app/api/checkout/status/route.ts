import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DokuQrisClient } from "@/lib/doku-qris";

export async function GET(req: NextRequest) {
  const trxId = req.nextUrl.searchParams.get("trx_id");
  if (!trxId) {
    return NextResponse.json({ error: "trx_id required" }, { status: 400 });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { trxId },
    select: { id: true, status: true, paidAt: true, paymentInfo: true, channelCode: true },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Jika status masih PENDING dan metode bayar QRIS, coba cek ke DOKU SNAP QRIS query
  if (transaction.status === "PENDING" && transaction.channelCode === "QRIS" && transaction.paymentInfo) {
    try {
      const info = transaction.paymentInfo as Record<string, string>;
      const dokuRefNo = info.dokuReferenceNo || `SIM-${trxId}`;
      const client = await DokuQrisClient.fromSystemSettings();
      const qrisStatus = await client.queryQris({
        originalPartnerReferenceNo: trxId,
        originalReferenceNo: dokuRefNo,
      });

      if (qrisStatus.latestTransactionStatus === "00") {
        const paidDate = qrisStatus.paidTime ? new Date(qrisStatus.paidTime) : new Date();
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: "PAID", paidAt: paidDate },
        });
        return NextResponse.json({ status: "PAID", paidAt: paidDate.toISOString() });
      }
    } catch (err) {
      console.error("Gagal cek status DOKU QRIS:", err);
    }
  }

  return NextResponse.json({
    status: transaction.status,
    paidAt: transaction.paidAt?.toISOString() || null,
  });
}

