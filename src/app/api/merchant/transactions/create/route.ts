import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymenkuClient } from "@/lib/paymenku";
import { logAudit, getClientIp, getUserAgent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not configured" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const {
      channel_code,
      amount,
      reference_id,
      customer_name,
      customer_email,
      customer_phone,
      return_url,
      order_items,
    } = body;

    // Add Platform Fee (Admin Revenue)
    const platformFee = 500;
    const totalAmount = parseFloat(amount) + platformFee;

    // Create Paymenku client
    const client = await PaymenkuClient.fromTenant(tenantId);

    // Create transaction via Paymenku API
    const result = await client.createTransaction({
      channel_code,
      amount: totalAmount,
      reference_id,
      customer_name,
      customer_email,
      customer_phone,
      return_url,
      order_items,
    });

    const data = result.data as Record<string, unknown>;

    // Store transaction in DB
    const paymentInfo = data.payment_info as Record<string, unknown> | undefined;

    const transaction = await prisma.transaction.create({
      data: {
        tenantId,
        trxId: String(data.trx_id),
        referenceId: reference_id,
        amount,
        platformFee,
        status: "PENDING",
        channelCode: channel_code,
        customerName: customer_name,
        customerEmail: customer_email,
        customerPhone: customer_phone || null,
        paymentInfo: paymentInfo ? (paymentInfo as Record<string, string | number | boolean>) : undefined,
        orderItems: order_items ? (order_items as Array<Record<string, string | number>>) : undefined,
        payUrl: data.pay_url ? String(data.pay_url) : null,
        returnUrl: return_url,
        expiresAt: paymentInfo?.expiration_date
          ? new Date(String(paymentInfo.expiration_date))
          : null,
      },
    });

    await logAudit({
      userId: session.user.id,
      userName: session.user.name || undefined,
      action: "transaction.create",
      target: `transaction:${transaction.trxId}`,
      details: { amount, channel_code, reference_id },
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
    console.error("Transaction create error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal membuat transaksi",
      },
      { status: 500 }
    );
  }
}
