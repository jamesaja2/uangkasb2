import { prisma } from "./prisma";
import { AuditStatus } from "@prisma/client";

export interface AuditLogParams {
  userId?: string;
  userName?: string;
  action: string;
  target?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status?: AuditStatus;
}

/**
 * Log an audit event to the database.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        userName: params.userName,
        action: params.action,
        target: params.target,
        details: params.details ? (params.details as object) : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        status: params.status || "SUCCESS",
      },
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error("[AuditLog] Failed to write audit log:", error);
  }
}

/**
 * Extract IP address from request headers.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Extract user agent from request headers.
 */
export function getUserAgent(headers: Headers): string {
  return headers.get("user-agent") || "unknown";
}
