import crypto from "crypto";
import { prisma } from "./prisma";
import { safeDecrypt } from "./encryption";

// ─── Types ──────────────────────────────────────

export interface CreateTransactionParams {
  channel_code: string;
  amount: number;
  reference_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  return_url: string;
  order_items?: Array<{ name: string; quantity?: number }>;
}

export interface ListTransactionsParams {
  page?: number;
  per_page?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  channel_code?: string;
  reference_id?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface RefundParams {
  trx_id: string;
  refund_amount: number;
  reason?: string;
}

export interface FeeCalculatorParams {
  amount: number;
  code?: string;
}

export interface PaymentInstructionParams {
  code: string;
  pay_code?: string;
  amount?: number;
  allow_html?: 0 | 1;
}

export interface PaymenkuResponse<T = unknown> {
  status: string;
  data: T;
  message?: string;
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// ─── PaymenkuClient ─────────────────────────────

const BASE_URL = "https://paymenku.com/api/v1";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export class PaymenkuClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Create a PaymenkuClient using the tenant's API key or global fallback.
   */
  static async fromTenant(tenantId?: string): Promise<PaymenkuClient> {
    let apiKey: string | null = null;

    // Try tenant-specific key first
    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { apiKeyLive: true, apiKeyTest: true },
      });

      if (tenant?.apiKeyLive) {
        apiKey = safeDecrypt(tenant.apiKeyLive);
      } else if (tenant?.apiKeyTest) {
        apiKey = safeDecrypt(tenant.apiKeyTest);
      }
    }

    // Fallback to global system setting
    if (!apiKey) {
      const settings = await prisma.systemSetting.findMany({
        where: {
          key: { in: ["paymenku_api_key_live", "paymenku_api_key_test"] },
        },
      });

      const liveSetting = settings.find(
        (s) => s.key === "paymenku_api_key_live"
      );
      const testSetting = settings.find(
        (s) => s.key === "paymenku_api_key_test"
      );

      if (liveSetting?.value) {
        apiKey = safeDecrypt(liveSetting.value);
      } else if (testSetting?.value) {
        apiKey = safeDecrypt(testSetting.value);
      }
    }

    if (!apiKey) {
      throw new Error(
        "No Paymenku API key configured. Please set it in Admin Settings."
      );
    }

    return new PaymenkuClient(apiKey);
  }

  // ─── Internal Request Method ────────────────

  private generateIdempotencyKey(): string {
    return crypto.randomUUID();
  }

  private async request<T>(
    method: "GET" | "POST",
    endpoint: string,
    body?: Record<string, unknown>,
    params?: Record<string, string | number | undefined>,
    retryCount = 0
  ): Promise<PaymenkuResponse<T>> {
    const url = new URL(`${BASE_URL}${endpoint}`);

    // Add query parameters for GET requests
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    // Add Idempotency-Key for mutation requests
    if (method === "POST") {
      headers["Idempotency-Key"] = this.generateIdempotencyKey();
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && method === "POST") {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), fetchOptions);

    // Handle rate limiting (429)
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const delayMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : RETRY_DELAY_MS * Math.pow(2, retryCount);

      if (retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.request<T>(method, endpoint, body, params, retryCount + 1);
      }

      throw new PaymenkuError(
        "Rate limit exceeded. Please try again later.",
        429,
        {
          retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
        }
      );
    }

    const data = await response.json();

    if (!response.ok) {
      throw new PaymenkuError(
        data.message || `Request failed with status ${response.status}`,
        response.status,
        data
      );
    }

    // Extract rate limit info from headers
    const rateLimitInfo: RateLimitInfo = {
      limit: parseInt(response.headers.get("X-RateLimit-Limit") || "60", 10),
      remaining: parseInt(
        response.headers.get("X-RateLimit-Remaining") || "60",
        10
      ),
      reset: parseInt(response.headers.get("X-RateLimit-Reset") || "0", 10),
    };

    return {
      ...data,
      _rateLimit: rateLimitInfo,
    };
  }

  // ─── API Methods ────────────────────────────

  /** Create a new transaction */
  async createTransaction(
    params: CreateTransactionParams
  ): Promise<PaymenkuResponse> {
    return this.request("POST", "/transaction/create", params as unknown as Record<string, unknown>);
  }

  /** List transactions with pagination and filters */
  async listTransactions(
    params?: ListTransactionsParams
  ): Promise<PaymenkuResponse> {
    return this.request("GET", "/transactions", undefined, params as unknown as Record<string, string | number | undefined>);
  }

  /** Check status of a single transaction */
  async checkStatus(orderId: string): Promise<PaymenkuResponse> {
    return this.request("GET", `/check-status/${encodeURIComponent(orderId)}`);
  }

  /** Cancel a pending transaction (QRIS only) */
  async cancelTransaction(trxId: string): Promise<PaymenkuResponse> {
    return this.request("POST", "/transaction/cancel", { trx_id: trxId });
  }

  /** Refund a paid transaction (E-Wallet only) */
  async refundTransaction(params: RefundParams): Promise<PaymenkuResponse> {
    return this.request("POST", "/transaction/refund", params as unknown as Record<string, unknown>);
  }

  /** List available payment channels */
  async getPaymentChannels(): Promise<PaymenkuResponse> {
    return this.request("GET", "/payment-channels");
  }

  /** Calculate fees for a given amount and channel */
  async getFeeCalculator(
    params: FeeCalculatorParams
  ): Promise<PaymenkuResponse> {
    return this.request("GET", "/merchant/fee-calculator", undefined, params as unknown as Record<string, string | number | undefined>);
  }

  /** Get payment instructions for a channel */
  async getPaymentInstruction(
    params: PaymentInstructionParams
  ): Promise<PaymenkuResponse> {
    return this.request("GET", "/payment/instruction", undefined, params as unknown as Record<string, string | number | undefined>);
  }

  /** Get open payment details */
  async getOpenPayment(uuid: string): Promise<PaymenkuResponse> {
    return this.request(
      "GET",
      `/open-payment/${encodeURIComponent(uuid)}`
    );
  }

  // ─── Webhook Signature Verification ─────────

  /**
   * Verify the HMAC-SHA256 signature from Paymenku webhook callback.
   * Signature = HMAC-SHA256(timestamp + "." + rawBody, secretKey)
   */
  static verifyWebhookSignature(
    signature: string,
    timestamp: string,
    rawBody: string,
    secretKey: string
  ): boolean {
    const payload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(payload)
      .digest("hex");

    // Timing-safe comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex")
      );
    } catch {
      return false;
    }
  }

  /**
   * Verify timestamp freshness (reject if older than maxAgeSeconds).
   */
  static verifyTimestamp(
    timestamp: string,
    maxAgeSeconds = 300
  ): boolean {
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) return false;
    const now = Math.floor(Date.now() / 1000);
    return Math.abs(now - ts) <= maxAgeSeconds;
  }
}

// ─── Error Class ────────────────────────────────

export class PaymenkuError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "PaymenkuError";
    this.status = status;
    this.data = data;
  }
}
