import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in IDR
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format date to locale string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Generate a URL-friendly slug from a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Status badge color mapping
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    PAID: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    paid: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    EXPIRED: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    expired: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    CANCELLED: "bg-red-500/10 text-red-500 border-red-500/20",
    cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
    FAILED: "bg-red-500/10 text-red-500 border-red-500/20",
    failed: "bg-red-500/10 text-red-500 border-red-500/20",
    REFUNDED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    refunded: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    ACTIVE: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    SUSPENDED: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    BLOCKED: "bg-red-500/10 text-red-500 border-red-500/20",
    INACTIVE: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    DELIVERED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    RETRYING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    SUCCESS: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  };
  return colors[status] || "bg-gray-500/10 text-gray-500 border-gray-500/20";
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

export interface StandardOrderItem {
  name: string;
  quantity: number;
  price?: number;
  subtotal?: number;
  [key: string]: unknown;
}

/**
 * Safely parse orderItems from database or API payload into standard format
 */
export function parseOrderItems(items: unknown, totalAmount?: number): StandardOrderItem[] {
  if (!items || !Array.isArray(items) || items.length === 0) {
    if (totalAmount && totalAmount > 0) {
      return [{ name: "Item Transaksi", quantity: 1, price: totalAmount, subtotal: totalAmount }];
    }
    return [];
  }

  const parsed: StandardOrderItem[] = items.map((item): StandardOrderItem => {
    if (!item || typeof item !== "object") {
      return { name: "Item", quantity: 1, price: undefined, subtotal: undefined };
    }
    const record = item as Record<string, unknown>;
    const name = String(record.name || record.nama || record.product || record.item || "Item Pesanan");
    const quantity = Number(record.quantity || record.qty || record.jumlah || 1) || 1;
    const priceRaw = record.price ?? record.harga ?? record.unit_price ?? record.unitPrice ?? record.amount;
    const price = priceRaw !== undefined && priceRaw !== null && !isNaN(Number(priceRaw)) ? Number(priceRaw) : undefined;
    const subtotalRaw = record.subtotal ?? record.total ?? (price !== undefined ? price * quantity : undefined);
    const subtotal = subtotalRaw !== undefined && subtotalRaw !== null && !isNaN(Number(subtotalRaw)) ? Number(subtotalRaw) : undefined;

    return {
      ...record,
      name,
      quantity,
      price,
      subtotal,
    };
  });

  // Smart fallback: If unit price wasn't stored in database JSON, calculate from transaction amount
  if (totalAmount && totalAmount > 0) {
    if (parsed.length === 1 && parsed[0].price === undefined) {
      const qty = parsed[0].quantity || 1;
      parsed[0].price = Math.round(totalAmount / qty);
      parsed[0].subtotal = totalAmount;
    } else if (parsed.length > 1 && parsed.every(item => item.price === undefined)) {
      const totalQty = parsed.reduce((sum, item) => sum + (item.quantity || 1), 0);
      if (totalQty > 0) {
        const avgPrice = Math.round(totalAmount / totalQty);
        parsed.forEach((item, idx) => {
          item.price = avgPrice;
          item.subtotal = idx === parsed.length - 1 
            ? totalAmount - (avgPrice * (totalQty - (item.quantity || 1))) 
            : avgPrice * (item.quantity || 1);
        });
      }
    }
  }

  return parsed;
}

/**
 * Format order items into separate CSV string representations
 */
export function formatOrderItemsForCSV(items: unknown, totalAmount?: number): {
  names: string;
  quantities: string;
  prices: string;
  subtotals: string;
  details: string;
} {
  const parsed = parseOrderItems(items, totalAmount);
  if (parsed.length === 0) {
    return { names: "-", quantities: "-", prices: "-", subtotals: "-", details: "-" };
  }

  const names = parsed.map((item) => item.name).join("; ");
  const quantities = parsed.map((item) => item.quantity.toString()).join("; ");
  const prices = parsed
    .map((item) => (item.price !== undefined ? formatCurrency(item.price) : "-"))
    .join("; ");
  const subtotals = parsed
    .map((item) => (item.subtotal !== undefined ? formatCurrency(item.subtotal) : "-"))
    .join("; ");

  const details = parsed
    .map((item, index) => {
      let detail = `${index + 1}. ${item.name} (Qty: ${item.quantity}`;
      if (item.price !== undefined) {
        detail += `, Harga: ${formatCurrency(item.price)}`;
      }
      if (item.subtotal !== undefined) {
        detail += `, Subtotal: ${formatCurrency(item.subtotal)}`;
      }
      detail += ")";
      return detail;
    })
    .join(" | ");

  return { names, quantities, prices, subtotals, details };
}

