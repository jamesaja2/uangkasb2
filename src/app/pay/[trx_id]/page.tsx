import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CheckoutClient from "./checkout-client";

export default async function CheckoutPage(props: {
  params: Promise<{ trx_id: string }>;
}) {
  const { trx_id } = await props.params;

  const transaction = await prisma.transaction.findUnique({
    where: { trxId: trx_id },
    include: { tenant: true },
  });

  if (!transaction) {
    notFound();
  }

  return (
    <CheckoutClient
      transaction={{
        trxId: transaction.trxId,
        referenceId: transaction.referenceId,
        amount: transaction.amount.toString(),
        totalFee: transaction.totalFee?.toString() || null,
        status: transaction.status,
        channelCode: transaction.channelCode,
        customerName: transaction.customerName,
        customerEmail: transaction.customerEmail,
        paymentInfo: transaction.paymentInfo as Record<string, unknown> | null,
        orderItems: transaction.orderItems as Array<{
          name: string;
          quantity?: number;
          price?: number;
          subtotal?: number;
        }> | null,
        payUrl: transaction.payUrl,
        paidAt: transaction.paidAt?.toISOString() || null,
        expiresAt: transaction.expiresAt?.toISOString() || null,
        createdAt: transaction.createdAt.toISOString(),
        tenantName: transaction.tenant?.name || "Payment byJames",
      }}
    />
  );
}
