import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PaymenkuClient } from "@/lib/paymenku";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const amount = req.nextUrl.searchParams.get("amount");
  const code = req.nextUrl.searchParams.get("code");

  if (!amount) {
    return NextResponse.json({ error: "amount required" }, { status: 400 });
  }

  try {
    const client = await PaymenkuClient.fromTenant(
      session.user.tenantId || undefined
    );
    const result = await client.getFeeCalculator({
      amount: parseFloat(amount),
      code: code || undefined,
    });

    return NextResponse.json(result.data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal menghitung fee",
      },
      { status: 500 }
    );
  }
}
