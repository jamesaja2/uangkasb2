import { prisma } from "./prisma";

export interface UangKasConfig {
  hargaDasar: number;
  tanggalDeadline: number; // 1 - 31 (hari dalam bulan)
  denda: number;
}

export interface UangKasBillInfo {
  periodName: string; // e.g. "Agustus 2026"
  periodCode: string; // e.g. "2026-08"
  hargaDasar: number;
  tanggalDeadline: number;
  deadlineDateStr: string; // e.g. "10 Agustus 2026"
  isOverdue: boolean;
  appliedDenda: number;
  weeksLate: number;
  dendaPerMinggu: number;
  subtotal: number;
  mdrRate: number; // 0.007 (0,7%)
  mdrFee: number;
  totalPay: number;
  isPaid: boolean;
  paidAt?: string | null;
  paidTrxId?: string | null;
  pendingTrxId?: string | null;
  pendingPayUrl?: string | null;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * Mengambil konfigurasi Uang Kas dari database SystemSetting
 */
export async function getUangKasConfig(): Promise<UangKasConfig> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: ["uangkas_harga_dasar", "uangkas_tanggal_deadline", "uangkas_denda"],
      },
    },
  });

  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }

  const hargaDasar = parseInt(map.uangkas_harga_dasar || "50000", 10) || 50000;
  const tanggalDeadline = Math.min(31, Math.max(1, parseInt(map.uangkas_tanggal_deadline || "10", 10) || 10));
  const denda = parseInt(map.uangkas_denda || "5000", 10) || 0;

  return {
    hargaDasar,
    tanggalDeadline,
    denda,
  };
}

/**
 * Menghitung status dan tagihan Uang Kas untuk tenant/user di bulan aktif
 */
export async function getUangKasBill(tenantId: string): Promise<UangKasBillInfo> {
  const config = await getUangKasConfig();
  const now = new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth(); // 0 - 11
  const monthName = MONTH_NAMES[monthIndex];

  const periodName = `${monthName} ${year}`;
  const periodCode = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const deadlineDateStr = `${config.tanggalDeadline} ${monthName} ${year}`;

  // Cek awal dan akhir bulan berjalan
  const startOfMonth = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  // Cari transaksi bulan ini untuk tenant ini yang PAID atau PENDING
  const transactionsThisMonth = await prisma.transaction.findMany({
    where: {
      tenantId,
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
      status: {
        in: ["PAID", "PENDING"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const paidTrx = transactionsThisMonth.find((t) => t.status === "PAID");
  const pendingTrx = !paidTrx ? transactionsThisMonth.find((t) => t.status === "PENDING") : null;

  const isPaid = Boolean(paidTrx);

  // Keterlambatan: jika hari ini melebihi tanggal deadline dan belum lunas
  const currentDay = now.getDate();
  const isOverdue = !isPaid && currentDay > config.tanggalDeadline;
  
  // Denda dihitung per minggu (setiap kelipatan 7 hari atau mulai minggu baru terhitung 1 minggu denda)
  const daysLate = isOverdue ? Math.max(1, currentDay - config.tanggalDeadline) : 0;
  const weeksLate = isOverdue ? Math.ceil(daysLate / 7) : 0;
  const appliedDenda = isOverdue ? (weeksLate * config.denda) : 0;

  const subtotal = config.hargaDasar + appliedDenda;

  // MDR tepat 0.7% dibebankan ke pembayar
  const mdrRate = 0.007;
  const mdrFee = Math.round(subtotal * mdrRate);
  const totalPay = subtotal + mdrFee;

  return {
    periodName,
    periodCode,
    hargaDasar: config.hargaDasar,
    tanggalDeadline: config.tanggalDeadline,
    deadlineDateStr,
    isOverdue,
    appliedDenda,
    weeksLate,
    dendaPerMinggu: config.denda,
    subtotal,
    mdrRate,
    mdrFee,
    totalPay,
    isPaid,
    paidAt: paidTrx?.paidAt ? paidTrx.paidAt.toISOString() : null,
    paidTrxId: paidTrx ? paidTrx.trxId : null,
    pendingTrxId: pendingTrx ? pendingTrx.trxId : null,
    pendingPayUrl: pendingTrx?.payUrl || null,
  };
}
