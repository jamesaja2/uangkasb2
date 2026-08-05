import { NextRequest, NextResponse } from "next/server";
import { PaymenkuClient } from "@/lib/paymenku";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const payCode = req.nextUrl.searchParams.get("pay_code") || undefined;
  const amount = req.nextUrl.searchParams.get("amount") || undefined;
  const allowHtml = req.nextUrl.searchParams.get("allow_html") || "1";

  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  try {
    const client = await PaymenkuClient.fromTenant();

    const result = await client.getPaymentInstruction({
      code,
      pay_code: payCode,
      amount: amount ? parseFloat(amount) : undefined,
      allow_html: allowHtml === "1" ? 1 : 0,
    });

    return NextResponse.json({
      instructions: result.data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal memuat instruksi",
        instructions: "",
      },
      { status: 500 }
    );
  }
}
