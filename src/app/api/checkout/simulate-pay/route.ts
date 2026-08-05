import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { trx_id } = body;

    if (!trx_id) {
      return NextResponse.json({ error: "trx_id required" }, { status: 400 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { trxId: trx_id },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    if (transaction.status === "PAID") {
      return NextResponse.json({ success: true, status: "PAID", message: "Transaksi sudah lunas" });
    }

    const updated = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      status: updated.status,
      paidAt: updated.paidAt,
      message: "Simulasi pembayaran berhasil (Lunas)!",
    });
  } catch (error) {
    console.error("Error simulate pay:", error);
    return NextResponse.json({ error: "Gagal simulasi pembayaran" }, { status: 500 });
  }
}
