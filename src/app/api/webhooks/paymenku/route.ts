import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PaymenkuClient } from "@/lib/paymenku";
import { safeDecrypt } from "@/lib/encryption";
import { logAudit, getClientIp } from "@/lib/audit";

/**
 * Paymenku Webhook Callback Handler
 *
 * Validates HMAC-SHA256 signature, processes payment status updates,
 * enforces idempotency, and forwards to merchant webhook URLs.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Read raw body and headers
    const rawBody = await req.text();
    const signature = req.headers.get("x-paymenku-signature") || "";
    const timestamp = req.headers.get("x-paymenku-timestamp") || "";

    // 2. Get webhook secret from system settings
    const secretSetting = await prisma.systemSetting.findUnique({
      where: { key: "paymenku_webhook_secret" },
    });

    const webhookSecret = secretSetting
      ? safeDecrypt(secretSetting.value)
      : null;

    let signatureValid = false;

    if (webhookSecret && signature && timestamp) {
      // 3. Verify HMAC-SHA256 signature
      signatureValid = PaymenkuClient.verifyWebhookSignature(
        signature,
        timestamp,
        rawBody,
        webhookSecret
      );

      // 4. Verify timestamp freshness (5 minute window)
      if (signatureValid) {
        signatureValid = PaymenkuClient.verifyTimestamp(timestamp, 300);
      }
    }

    // Parse the payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const trxId = String(payload.trx_id || "");
    const event = String(payload.event || "payment.status_updated");
    const status = String(payload.status || "").toUpperCase();

    if (!trxId) {
      return NextResponse.json(
        { error: "Missing trx_id" },
        { status: 400 }
      );
    }

    // 5. Idempotency check — prevent duplicate processing
    const existingLog = await prisma.webhookLog.findFirst({
      where: {
        trxId,
        event,
        deliveryStatus: "DELIVERED",
      },
    });

    if (existingLog) {
      // Already processed, return success to stop retries
      return NextResponse.json({
        received: true,
        message: "Already processed (idempotent)",
      });
    }

    // 6. Find the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { trxId },
      include: { tenant: true },
    });

    // 7. Update transaction status if valid
    if (transaction && signatureValid) {
      const validStatuses = [
        "PENDING",
        "PAID",
        "EXPIRED",
        "CANCELLED",
        "FAILED",
        "REFUNDED",
      ];

      if (validStatuses.includes(status)) {
        await prisma.transaction.update({
          where: { trxId },
          data: {
            status: status as "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "FAILED" | "REFUNDED",
            totalFee: payload.total_fee
              ? parseFloat(String(payload.total_fee))
              : undefined,
            amountReceived: payload.amount_received
              ? parseFloat(String(payload.amount_received))
              : undefined,
            paidAt: payload.paid_at
              ? new Date(String(payload.paid_at))
              : undefined,
          },
        });
      }
    }

    // 8. Log the webhook
    let merchantResponseStatus: number | null = null;
    let merchantResponseBody: string | null = null;
    let deliveryStatus: "DELIVERED" | "FAILED" | "PENDING" = signatureValid
      ? "DELIVERED"
      : "FAILED";

    // 9. Forward to merchant webhook URL (if configured)
    if (transaction?.tenant?.webhookUrl && signatureValid) {
      try {
        const forwardRes = await fetch(transaction.tenant.webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-PaymentByJames-Event": event,
          },
          body: rawBody,
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        merchantResponseStatus = forwardRes.status;
        merchantResponseBody = await forwardRes.text().catch(() => null);

        if (!forwardRes.ok) {
          deliveryStatus = "FAILED";
        }
      } catch (forwardError) {
        deliveryStatus = "FAILED";
        merchantResponseBody =
          forwardError instanceof Error
            ? forwardError.message
            : "Forward failed";
      }
    }

    // 10. Store webhook log
    await prisma.webhookLog.create({
      data: {
        tenantId: transaction?.tenantId || null,
        transactionId: transaction?.id || null,
        trxId,
        event,
        payload: payload as object,
        signatureValid,
        responseStatus: merchantResponseStatus,
        responseBody: merchantResponseBody,
        deliveryStatus,
        attempts: 1,
      },
    });

    // 11. Audit log
    await logAudit({
      action: "webhook.received",
      target: `transaction:${trxId}`,
      details: {
        event,
        status,
        signatureValid,
        deliveryStatus,
      },
      ipAddress: getClientIp(req.headers),
    });

    // 12. Return 200 to acknowledge
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
