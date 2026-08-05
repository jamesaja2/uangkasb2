import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PaymenkuClient } from "@/lib/paymenku";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await PaymenkuClient.fromTenant(
      session.user.tenantId || undefined
    );
    const result = await client.getPaymentChannels();
    return NextResponse.json({ channels: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal memuat payment channels",
      },
      { status: 500 }
    );
  }
}
