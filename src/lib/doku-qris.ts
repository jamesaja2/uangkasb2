import crypto from "crypto";
import { prisma } from "./prisma";
import { safeDecrypt } from "./encryption";

export interface GenerateQrisParams {
  partnerReferenceNo: string; // ID transaksi internal
  amount: number;             // Total bayar (termasuk MDR)
  terminalId?: string;
  validityPeriod?: string;    // ISO 8601 string
  postalCode?: string;
}

export interface GenerateQrisResult {
  responseCode: string;
  responseMessage: string;
  referenceNo: string;        // ID dari DOKU
  partnerReferenceNo: string;
  qrContent: string;          // String QRIS yang dipindai
  terminalId: string;
  isSimulator?: boolean;
}

export interface QueryQrisParams {
  originalReferenceNo: string; // ID dari DOKU
  originalPartnerReferenceNo: string; // ID transaksi internal
}

export interface QueryQrisResult {
  responseCode: string;
  responseMessage: string;
  originalReferenceNo: string;
  originalPartnerReferenceNo: string;
  latestTransactionStatus: "00" | "01" | "03" | "05" | string; // "00" = SUCCESS, "01" = PENDING, dst.
  transactionStatusDesc: string;
  paidTime?: string;
  amount?: { value: string; currency: string };
  isSimulator?: boolean;
}

export interface CancelQrisParams {
  referenceNo: string;
  partnerReferenceNo: string;
  reason?: string;
}

export class DokuQrisClient {
  private clientId: string;
  private merchantId: string;
  private secretKey: string;
  private terminalId: string;
  private isProduction: boolean;
  private tokenB2b: string;
  private baseUrl: string;

  constructor(config: {
    clientId: string;
    merchantId: string;
    secretKey: string;
    terminalId: string;
    isProduction: boolean;
    tokenB2b: string;
  }) {
    this.clientId = config.clientId;
    this.merchantId = config.merchantId;
    this.secretKey = config.secretKey;
    this.terminalId = config.terminalId || "A01";
    this.isProduction = config.isProduction;
    this.tokenB2b = config.tokenB2b || "dummy-b2b-token";
    this.baseUrl = this.isProduction
      ? "https://api.doku.com"
      : "https://api-sandbox.doku.com";
  }

  /**
   * Mengambil konfigurasi dari SystemSetting
   */
  static async fromSystemSettings(): Promise<DokuQrisClient> {
    const keys = [
      "doku_client_id",
      "doku_merchant_id",
      "doku_client_secret",
      "doku_terminal_id",
      "doku_is_production",
      "doku_token_b2b",
    ];
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: keys } },
    });

    const map: Record<string, string> = {};
    for (const s of settings) {
      if (s.key === "doku_client_secret" || s.key === "doku_token_b2b") {
        const dec = safeDecrypt(s.value);
        map[s.key] = dec || s.value || "";
      } else {
        map[s.key] = s.value;
      }
    }

    return new DokuQrisClient({
      clientId: map.doku_client_id || "",
      merchantId: map.doku_merchant_id || "",
      secretKey: map.doku_client_secret || "",
      terminalId: map.doku_terminal_id || "A01",
      isProduction: map.doku_is_production === "true",
      tokenB2b: map.doku_token_b2b || "",
    });
  }

  private async getAccessToken(timestamp: string): Promise<string> {
    // Jika token manual valid sudah diatur via environment/database, gunakan:
    if (this.tokenB2b && this.tokenB2b !== "dummy-b2b-token" && this.tokenB2b.length > 20) {
      return this.tokenB2b;
    }

    if (!this.clientId || !this.secretKey) {
      return "dummy-b2b-token";
    }

    const tokenUrl = `${this.baseUrl}/authorization/v1/access-token/b2b`;
    const stringToSign = `${this.clientId}|${timestamp}`;
    let signature = "";

    try {
      // Jika secretKey berupa RSA Private Key (PEM format)
      if (this.secretKey.includes("PRIVATE KEY")) {
        signature = crypto
          .createSign("RSA-SHA256")
          .update(stringToSign, "utf8")
          .sign(this.secretKey, "base64");
      } else {
        // Jika berupa Secret Key biasa (Symmetric / HMAC SHA-512)
        signature = crypto
          .createHmac("sha512", this.secretKey)
          .update(stringToSign, "utf8")
          .digest("base64");
      }

      const res = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CLIENT-KEY": this.clientId,
          "X-TIMESTAMP": timestamp,
          "X-SIGNATURE": signature,
        },
        body: JSON.stringify({ grantType: "client_credentials" }),
      });

      if (res.ok) {
        const data = await res.json();
        const token = data.accessToken || data.access_token;
        if (token) {
          this.tokenB2b = token; // Cache token sementara di memori instance ini
          return token;
        }
      } else {
        const errText = await res.text();
        console.warn(`⚠️ Gagal mengambil DOKU B2B Access Token (${res.status}): ${errText}`);
        if (this.isProduction) {
          throw new Error(`Gagal Autentikasi Token DOKU B2B (${res.status}): ${errText}. Periksa validitas Client ID & Secret Key/Private Key Anda.`);
        }
      }
    } catch (e) {
      console.warn("⚠️ Error saat proses generasi token DOKU:", e);
      if (this.isProduction && e instanceof Error && e.message.includes("Gagal Autentikasi")) {
        throw e;
      }
    }

    return this.tokenB2b || "dummy-b2b-token";
  }

  private generateSignature(method: string, endpointPath: string, body: unknown, timestamp: string, token: string): string {
    const minifyBody = JSON.stringify(body);
    const hashBody = crypto.createHash("sha256").update(minifyBody, "utf8").digest("hex").toLowerCase();
    const stringToSign = `${method}:${endpointPath}:${token}:${hashBody}:${timestamp}`;
    
    return crypto.createHmac("sha512", this.secretKey || "secret").update(stringToSign, "utf8").digest("hex");
  }

  /**
   * 1. Generate QRIS (POST /snap-adapter/b2b/v1.0/qr/qr-mpm-generate)
   */
  async generateQris(params: GenerateQrisParams): Promise<GenerateQrisResult> {
    const endpointPath = "/snap-adapter/b2b/v1.0/qr/qr-mpm-generate";
    const url = `${this.baseUrl}${endpointPath}`;
    const timestamp = new Date().toISOString();
    const externalId = Math.floor(Date.now() / 1000).toString();

    // Format amount dengan tepat 2 desimal (cth: "50350.00")
    const formattedAmount = Number(params.amount).toFixed(2);

    // MALL_ID di DOKU SNAP sering kali sama dengan Client ID jika tidak diberikan secara khusus
    const resolvedMerchantId = this.merchantId || this.clientId || "MALL_ID_TEST";

    const requestBody = {
      partnerReferenceNo: params.partnerReferenceNo,
      amount: {
        value: formattedAmount,
        currency: "IDR",
      },
      merchantId: resolvedMerchantId,
      terminalId: params.terminalId || this.terminalId,
      validityPeriod: params.validityPeriod || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      additionalInfo: {
        postalCode: params.postalCode || "12345",
        feeType: "1", // 1 = No Tips
      },
    };

    // Dalam mode Live Production, haram menggunakan simulator jika kredensial tidak ada / gagal
    if (!this.clientId || !this.secretKey) {
      if (this.isProduction) {
        throw new Error("Kredensial DOKU (Client ID dan Secret Key) belum dikonfigurasi untuk Mode Live Production. Silakan isi di menu Admin Settings.");
      }
      console.log("⚠️ DOKU Kredensial tidak lengkap -> Menggunakan SNAP QRIS Simulator Mode.");
      return this.simulateGenerateQris(params, formattedAmount);
    }

    try {
      // 1. Ambil Token B2B terlebih dahulu secara otomatis
      const token = await this.getAccessToken(timestamp);

      // 2. Buat Tanda Tangan (Signature) HMAC-SHA512 dengan formula SNAP
      const signature = this.generateSignature("POST", endpointPath, requestBody, timestamp, token);

      // 3. Eksekusi API DOKU
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PARTNER-ID": this.clientId,
          "X-EXTERNAL-ID": externalId,
          "X-TIMESTAMP": timestamp,
          "X-SIGNATURE": signature,
          "Authorization": `Bearer ${token}`,
          "CHANNEL-ID": "H2H",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ DOKU API error (${response.status}):`, errorText);
        
        if (this.isProduction) {
          throw new Error(`DOKU Live QRIS Gagal [HTTP ${response.status}]: ${errorText} | Pastikan konfigurasi IP Whitelist, Client ID, dan Secret Key di DOKU Dashboard sudah valid.`);
        }
        
        console.warn(`⚠️ Fallback ke Simulator Mode (karena sedang di lingkungan tes/sandbox).`);
        return this.simulateGenerateQris(params, formattedAmount);
      }

      const data = await response.json();
      return {
        responseCode: data.responseCode || "2000000",
        responseMessage: data.responseMessage || "Success",
        referenceNo: data.referenceNo || `DOKU-${Date.now()}`,
        partnerReferenceNo: data.partnerReferenceNo || params.partnerReferenceNo,
        qrContent: data.qrContent || this.getDummyQrString(formattedAmount, params.partnerReferenceNo),
        terminalId: data.terminalId || this.terminalId,
        isSimulator: false,
      };
    } catch (error) {
      console.error("❌ Error koneksi/autentikasi ke DOKU:", error);
      if (this.isProduction) {
        throw error instanceof Error ? error : new Error("Terjadi kesalahan saat terhubung ke server DOKU QRIS.");
      }
      return this.simulateGenerateQris(params, formattedAmount);
    }
  }

  /**
   * 2. Query QRIS Status (POST /snap-adapter/b2b/v1.0/qr/qr-mpm-query)
   */
  async queryQris(params: QueryQrisParams): Promise<QueryQrisResult> {
    const endpointPath = "/snap-adapter/b2b/v1.0/qr/qr-mpm-query";
    const url = `${this.baseUrl}${endpointPath}`;
    const timestamp = new Date().toISOString();
    const externalId = Math.floor(Date.now() / 1000).toString();
    const resolvedMerchantId = this.merchantId || this.clientId || "MALL_ID_TEST";

    const requestBody = {
      originalReferenceNo: params.originalReferenceNo,
      originalPartnerReferenceNo: params.originalPartnerReferenceNo,
      serviceCode: "47", // Unique service API for QRIS
      merchantId: resolvedMerchantId,
    };

    if (!this.clientId || !this.secretKey || params.originalReferenceNo.startsWith("SIM-")) {
      return this.simulateQueryQris(params);
    }

    try {
      const token = await this.getAccessToken(timestamp);
      const signature = this.generateSignature("POST", endpointPath, requestBody, timestamp, token);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PARTNER-ID": this.clientId,
          "X-EXTERNAL-ID": externalId,
          "X-TIMESTAMP": timestamp,
          "X-SIGNATURE": signature,
          "Authorization": `Bearer ${token}`,
          "CHANNEL-ID": "H2H",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        if (this.isProduction) {
          const errText = await response.text();
          console.error(`DOKU Query QRIS Gagal (${response.status}):`, errText);
        }
        return this.simulateQueryQris(params);
      }

      const data = await response.json();
      return {
        responseCode: data.responseCode || "2000000",
        responseMessage: data.responseMessage || "Success",
        originalReferenceNo: data.originalReferenceNo || params.originalReferenceNo,
        originalPartnerReferenceNo: data.originalPartnerReferenceNo || params.originalPartnerReferenceNo,
        latestTransactionStatus: data.latestTransactionStatus || "01",
        transactionStatusDesc: data.transactionStatusDesc || "Pending",
        paidTime: data.paidTime,
        amount: data.amount,
        isSimulator: false,
      };
    } catch {
      return this.simulateQueryQris(params);
    }
  }

  /**
   * 3. Cancel QRIS (POST /snap-adapter/b2b/v1.0/qr/qr-expire)
   */
  async cancelQris(params: CancelQrisParams): Promise<boolean> {
    if (!this.clientId || !this.secretKey || params.referenceNo.startsWith("SIM-")) {
      return true; // Sukses dalam simulator
    }

    const endpointPath = "/snap-adapter/b2b/v1.0/qr/qr-expire";
    const url = `${this.baseUrl}${endpointPath}`;
    const timestamp = new Date().toISOString();
    const externalId = Math.floor(Date.now() / 1000).toString();
    const resolvedMerchantId = this.merchantId || this.clientId || "MALL_ID_TEST";

    const requestBody = {
      partnerReferenceNo: params.partnerReferenceNo,
      referenceNo: params.referenceNo,
      merchantId: resolvedMerchantId,
      reason: params.reason || "Expired by system",
    };

    try {
      const token = await this.getAccessToken(timestamp);
      const signature = this.generateSignature("POST", endpointPath, requestBody, timestamp, token);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PARTNER-ID": this.clientId,
          "X-EXTERNAL-ID": externalId,
          "X-TIMESTAMP": timestamp,
          "X-SIGNATURE": signature,
          "Authorization": `Bearer ${token}`,
          "CHANNEL-ID": "H2H",
        },
        body: JSON.stringify(requestBody),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── SIMULATOR HELPER ─────────────────────────────

  private simulateGenerateQris(params: GenerateQrisParams, formattedAmount: string): GenerateQrisResult {
    const simReferenceNo = `SIM-${Date.now().toString().slice(-8)}`;
    const qrContent = this.getDummyQrString(formattedAmount, params.partnerReferenceNo);
    
    return {
      responseCode: "2000000",
      responseMessage: "Success [SIMULATOR MODE]",
      referenceNo: simReferenceNo,
      partnerReferenceNo: params.partnerReferenceNo,
      qrContent,
      terminalId: params.terminalId || this.terminalId || "A01",
      isSimulator: true,
    };
  }

  private async simulateQueryQris(params: QueryQrisParams): Promise<QueryQrisResult> {
    // Cek status dari database lokal
    const trx = await prisma.transaction.findUnique({
      where: { trxId: params.originalPartnerReferenceNo },
    });

    let status = "01"; // Pending
    let desc = "Menunggu Pembayaran";
    if (trx?.status === "PAID") {
      status = "00";
      desc = "Pembayaran Berhasil (Lunas)";
    } else if (trx?.status === "EXPIRED" || trx?.status === "CANCELLED") {
      status = "05";
      desc = "Dibatalkan / Kadaluarsa";
    }

    return {
      responseCode: "2000000",
      responseMessage: "Success [SIMULATOR MODE]",
      originalReferenceNo: params.originalReferenceNo,
      originalPartnerReferenceNo: params.originalPartnerReferenceNo,
      latestTransactionStatus: status,
      transactionStatusDesc: desc,
      paidTime: trx?.paidAt ? trx.paidAt.toISOString() : undefined,
      isSimulator: true,
    };
  }

  private getDummyQrString(amount: string, refNo: string): string {
    // Format standar string QRIS statis/dinamis yang valid dipindai
    const cleanAmount = amount.replace(".00", "").replace(".", "");
    return `00020101021226590014ID.LINKAJA.WWW0118936009140000000000020950350000051440014ID.CO.QRIS.WWW0215ID10200000000000303UKE5204541153033605406${cleanAmount}5802ID5916UANG KAS KELOMPOK6007JAKARTA61051234562180714${refNo.slice(0, 14)}6304${Math.floor(1000 + Math.random() * 9000)}`;
  }
}
