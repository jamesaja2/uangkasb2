import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUangKasBill } from "@/lib/uangkas";
import { DokuQrisClient } from "@/lib/doku-qris";
import { logAudit, getClientIp, getUserAgent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let tenantId = session.user.tenantId;
  if (!tenantId) {
    const defaultTenant = await prisma.tenant.findFirst();
    if (defaultTenant) {
      tenantId = defaultTenant.id;
    } else {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 400 });
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { forceNew } = body as { forceNew?: boolean };

    const bill = await getUangKasBill(tenantId);

    if (bill.isPaid) {
      return NextResponse.json(
        { error: "Anda sudah melunasi Uang Kas periode ini." },
        { status: 400 }
      );
    }

    // Jika sudah ada tagihan PENDING dan tidak meminta forceNew, kembalikan yang existing
    if (bill.pendingTrxId && !forceNew) {
      const existingTrx = await prisma.transaction.findUnique({
        where: { trxId: bill.pendingTrxId },
      });
      if (existingTrx) {
        return NextResponse.json({
          success: true,
          trxId: existingTrx.trxId,
          payUrl: existingTrx.payUrl || `/pay/${existingTrx.trxId}`,
          isExisting: true,
        });
      }
    }

    // Generate Transaksi & QRIS Baru
    const timestamp = Date.now();
    const trxId = `KAS-${timestamp}`;
    const referenceId = `KAS-${bill.periodCode.replace("-", "")}-${session.user.id.slice(0, 6).toUpperCase()}`;

    const client = await DokuQrisClient.fromSystemSettings();
    const qrisResult = await client.generateQris({
      partnerReferenceNo: trxId,
      amount: bill.totalPay, // Subtotal + 0,7% MDR ditanggung pembayar
    });

    const orderItems: Array<Record<string, unknown>> = [
      {
        name: `Uang Kas ${bill.periodName}`,
        quantity: 1,
        price: bill.hargaDasar,
        subtotal: bill.hargaDasar,
      },
    ];

    if (bill.appliedDenda > 0) {
      orderItems.push({
        name: `Denda Keterlambatan (Deadline tgl ${bill.tanggalDeadline})`,
        quantity: 1,
        price: bill.appliedDenda,
        subtotal: bill.appliedDenda,
      });
    }

    // Simpan di database (amount = subtotal penerimaan kas, totalFee = MDR 0,7%)
    const transaction = await prisma.transaction.create({
      data: {
        tenantId,
        trxId,
        referenceId,
        amount: bill.subtotal,
        totalFee: bill.mdrFee,
        amountReceived: bill.subtotal,
        status: "PENDING",
        channelCode: "QRIS",
        customerName: session.user.name || "Anggota Kas",
        customerEmail: session.user.email || "member@paymentbyjames.com",
        paymentInfo: {
          qrContent: qrisResult.qrContent,
          dokuReferenceNo: qrisResult.referenceNo,
          isSimulator: qrisResult.isSimulator,
          periodName: bill.periodName,
          hargaDasar: bill.hargaDasar,
          denda: bill.appliedDenda,
          mdrFee: bill.mdrFee,
          mdrRate: "0.7%",
          expiration_date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        } as any,
        orderItems: orderItems as any,
        payUrl: `/pay/${trxId}`,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name || undefined,
      action: "uangkas.checkout",
      target: `transaction:${transaction.trxId}`,
      details: { totalPay: bill.totalPay, period: bill.periodName },
      ipAddress: getClientIp(req.headers),
      userAgent: getUserAgent(req.headers),
    });

    return NextResponse.json({
      success: true,
      trxId: transaction.trxId,
      payUrl: transaction.payUrl,
      paymentInfo: transaction.paymentInfo,
    });
  } catch (error) {
    console.error("Uang Kas checkout error:", error);
    return NextResponse.json({ error: "Gagal memproses pembayaran Uang Kas." }, { status: 500 });
  }
}
