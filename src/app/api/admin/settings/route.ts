import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, safeDecrypt } from "@/lib/encryption";
import { logAudit, getClientIp, getUserAgent } from "@/lib/audit";

const SETTING_KEYS = [
  "paymenku_api_key_live",
  "paymenku_api_key_test",
  "paymenku_webhook_secret",
  "uangkas_harga_dasar",
  "uangkas_tanggal_deadline",
  "uangkas_denda",
  "doku_client_id",
  "doku_merchant_id",
  "doku_client_secret",
  "doku_terminal_id",
  "doku_is_production",
  "doku_token_b2b",
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.systemSetting.findMany({
    where: {
      key: { in: SETTING_KEYS },
    },
  });

  const result: Record<string, string> = {
    uangkas_harga_dasar: "50000",
    uangkas_tanggal_deadline: "10",
    uangkas_denda: "5000",
    doku_client_id: "",
    doku_merchant_id: "",
    doku_client_secret: "",
    doku_terminal_id: "A01",
    doku_is_production: "false",
    doku_token_b2b: "",
  };

  for (const s of settings) {
    if (["paymenku_api_key_live", "paymenku_api_key_test", "paymenku_webhook_secret", "doku_client_secret", "doku_token_b2b"].includes(s.key)) {
      const decrypted = safeDecrypt(s.value);
      if (s.key === "paymenku_api_key_live") {
        result.apiKeyLive = decrypted ? decrypted.slice(0, 10) + "..." + decrypted.slice(-4) : "";
      } else if (s.key === "paymenku_api_key_test") {
        result.apiKeyTest = decrypted ? decrypted.slice(0, 10) + "..." + decrypted.slice(-4) : "";
      } else if (s.key === "paymenku_webhook_secret") {
        result.webhookSecret = decrypted ? decrypted.slice(0, 6) + "..." + decrypted.slice(-4) : "";
      } else if (s.key === "doku_client_secret") {
        result.doku_client_secret = decrypted ? (decrypted.length > 8 ? decrypted.slice(0, 4) + "..." + decrypted.slice(-3) : "******") : "";
      } else if (s.key === "doku_token_b2b") {
        result.doku_token_b2b = decrypted ? (decrypted.length > 12 ? decrypted.slice(0, 8) + "..." + decrypted.slice(-4) : "******") : "";
      }
    } else {
      result[s.key] = s.value;
    }
  }

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    apiKeyLive,
    apiKeyTest,
    webhookSecret,
    uangkas_harga_dasar,
    uangkas_tanggal_deadline,
    uangkas_denda,
    doku_client_id,
    doku_merchant_id,
    doku_client_secret,
    doku_terminal_id,
    doku_is_production,
    doku_token_b2b,
  } = body;

  const updates: Array<{ key: string; value: string }> = [];

  if (apiKeyLive !== undefined && !String(apiKeyLive).includes("...")) {
    updates.push({ key: "paymenku_api_key_live", value: encrypt(apiKeyLive) });
  }
  if (apiKeyTest !== undefined && !String(apiKeyTest).includes("...")) {
    updates.push({ key: "paymenku_api_key_test", value: encrypt(apiKeyTest) });
  }
  if (webhookSecret !== undefined && !String(webhookSecret).includes("...")) {
    updates.push({ key: "paymenku_webhook_secret", value: encrypt(webhookSecret) });
  }

  // Uang Kas Settings
  if (uangkas_harga_dasar !== undefined) updates.push({ key: "uangkas_harga_dasar", value: String(uangkas_harga_dasar) });
  if (uangkas_tanggal_deadline !== undefined) updates.push({ key: "uangkas_tanggal_deadline", value: String(uangkas_tanggal_deadline) });
  if (uangkas_denda !== undefined) updates.push({ key: "uangkas_denda", value: String(uangkas_denda) });

  // DOKU QRIS Settings
  if (doku_client_id !== undefined) updates.push({ key: "doku_client_id", value: String(doku_client_id) });
  if (doku_merchant_id !== undefined) updates.push({ key: "doku_merchant_id", value: String(doku_merchant_id) });
  if (doku_terminal_id !== undefined) updates.push({ key: "doku_terminal_id", value: String(doku_terminal_id || "A01") });
  if (doku_is_production !== undefined) updates.push({ key: "doku_is_production", value: String(doku_is_production) });

  if (doku_client_secret !== undefined && !String(doku_client_secret).includes("...") && !String(doku_client_secret).includes("***")) {
    if (String(doku_client_secret).trim() === "") {
      updates.push({ key: "doku_client_secret", value: "" });
    } else {
      updates.push({ key: "doku_client_secret", value: encrypt(String(doku_client_secret)) });
    }
  }

  if (doku_token_b2b !== undefined && !String(doku_token_b2b).includes("...") && !String(doku_token_b2b).includes("***")) {
    if (String(doku_token_b2b).trim() === "") {
      updates.push({ key: "doku_token_b2b", value: "" });
    } else {
      updates.push({ key: "doku_token_b2b", value: encrypt(String(doku_token_b2b)) });
    }
  }

  for (const { key, value } of updates) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, updatedBy: session.user.id },
      update: { value, updatedBy: session.user.id },
    });
  }

  await logAudit({
    userId: session.user.id,
    userName: session.user.name || undefined,
    action: "settings.update",
    target: "system_settings",
    details: { keys: updates.map((u) => u.key) },
    ipAddress: getClientIp(req.headers),
    userAgent: getUserAgent(req.headers),
  });

  return NextResponse.json({ success: true });
}

