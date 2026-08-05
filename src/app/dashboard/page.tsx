"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  QrCode,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";

interface KasInfo {
  user: {
    name: string;
    email: string;
    role: string;
  };
  bill: {
    periodName: string;
    periodCode: string;
    hargaDasar: number;
    tanggalDeadline: number;
    deadlineDateStr: string;
    isOverdue: boolean;
    appliedDenda: number;
    subtotal: number;
    mdrRate: number;
    mdrFee: number;
    totalPay: number;
    isPaid: boolean;
    paidAt?: string | null;
    paidTrxId?: string | null;
    pendingTrxId?: string | null;
    pendingPayUrl?: string | null;
  };
  history: Array<{
    id: string;
    trxId: string;
    referenceId: string;
    amount: string;
    totalFee: string | null;
    status: string;
    createdAt: string;
    paidAt: string | null;
    payUrl: string | null;
    orderItems?: any;
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<KasInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchKasInfo();
  }, []);

  const fetchKasInfo = async () => {
    try {
      const res = await fetch("/api/uangkas/info");
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (error) {
      console.error("Gagal mengambil data uang kas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (forceNew = false) => {
    setProcessing(true);
    try {
      const res = await fetch("/api/uangkas/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceNew }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.payUrl) {
          window.location.href = result.payUrl;
        }
      } else {
        const err = await res.json();
        alert(err.error || "Gagal membuat transaksi uang kas.");
      }
    } catch (error) {
      console.error("Error checkout kas:", error);
      alert("Terjadi kesalahan sistem saat menghubungi DOKU QRIS.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="h-24 rounded-2xl shimmer bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-96 rounded-2xl shimmer bg-zinc-200 dark:bg-zinc-800" />
      </div>
    );
  }

  const bill = data?.bill;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 p-8 text-white shadow-xl shadow-indigo-500/20">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold text-white/90 backdrop-blur-md mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Portal Pembayaran Uang Kas
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Halo, {data?.user.name || "Anggota"}!
            </h1>
            <p className="text-indigo-100 text-sm mt-1">
              Pantau dan lunasi iuran kas kelompok Anda dengan mudah via DOKU SNAP QRIS.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15 text-right">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-indigo-200 font-semibold">Periode Aktif</p>
              <p className="text-lg font-bold text-white flex items-center gap-2 justify-end">
                <Calendar className="w-4 h-4 text-indigo-300" />
                {bill?.periodName || "Bulan Ini"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Billing Card */}
      {bill && (
        <Card className="border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl shadow-zinc-900/5 overflow-hidden rounded-3xl">
          <CardHeader className="border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/50 p-6 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Tagihan Uang Kas {bill.periodName}
                </CardTitle>
                <CardDescription className="text-sm text-zinc-500 mt-1">
                  Batas waktu pembayaran: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{bill.deadlineDateStr}</span> (Tanggal {bill.tanggalDeadline})
                </CardDescription>
              </div>

              <div>
                {bill.isPaid ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-3 py-1.5 text-sm font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> LUNAS PERIODE INI
                  </Badge>
                ) : bill.isOverdue ? (
                  <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20 px-3 py-1.5 text-sm font-bold flex items-center gap-1.5 animate-pulse">
                    <AlertTriangle className="w-4 h-4" /> TERLAMBAT (KENA DENDA)
                  </Badge>
                ) : (
                  <Badge className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 px-3 py-1.5 text-sm font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> BELUM DIBAYAR
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8 space-y-6">
            {bill.isPaid ? (
              <div className="py-8 text-center space-y-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Terima Kasih Atas Partisipasi Anda!
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
                  Iuran uang kas Anda untuk periode <strong className="text-zinc-900 dark:text-zinc-100">{bill.periodName}</strong> telah berhasil direkam dalam sistem.
                </p>
                {bill.paidAt && (
                  <p className="text-xs text-zinc-400">
                    Dilunasi pada {formatDate(bill.paidAt)} • ID: <span className="font-mono text-zinc-600 dark:text-zinc-300">{bill.paidTrxId}</span>
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Breakdown Rincian */}
                <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl p-5 sm:p-6 border border-zinc-200/60 dark:border-zinc-700/60 space-y-3.5">
                  <div className="flex justify-between items-center text-sm text-zinc-600 dark:text-zinc-400">
                    <span>Harga Dasar Uang Kas</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(bill.hargaDasar)}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      Denda Keterlambatan
                      {bill.isOverdue && <span className="text-xs text-red-500 font-semibold">(Melewati tgl {bill.tanggalDeadline})</span>}
                    </span>
                    <span className={`font-medium ${bill.isOverdue ? "text-red-600 dark:text-red-400 font-semibold" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {bill.appliedDenda > 0 ? `+ ${formatCurrency(bill.appliedDenda)}` : "Rp 0 (Tepat Waktu)"}
                    </span>
                  </div>

                  <div className="border-t border-dashed border-zinc-200 dark:border-zinc-700 pt-3 flex justify-between items-center text-sm text-zinc-600 dark:text-zinc-400">
                    <span>Subtotal Iuran</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatCurrency(bill.subtotal)}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/30 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                    <div>
                      <span className="font-semibold flex items-center gap-1">
                        <QrCode className="w-4 h-4" /> Biaya MDR QRIS (0,7%)
                      </span>
                      <p className="text-[11px] text-indigo-500">MDR 0,7% ditanggung oleh pembayar (tanpa biaya tambahan lain)</p>
                    </div>
                    <span className="font-bold text-base">+ {formatCurrency(bill.mdrFee)}</span>
                  </div>

                  <div className="border-t border-zinc-300 dark:border-zinc-700 pt-3.5 flex justify-between items-center">
                    <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">Total Yang Dibayar</span>
                    <span className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                      {formatCurrency(bill.totalPay)}
                    </span>
                  </div>
                </div>

                {/* Tombol Aksi */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  {bill.pendingPayUrl ? (
                    <>
                      <Button
                        size="lg"
                        onClick={() => window.location.href = bill.pendingPayUrl!}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-13 text-base rounded-xl shadow-lg shadow-indigo-500/20 transition-all"
                      >
                        <QrCode className="w-5 h-5 mr-2" /> Lanjutkan Pembayaran QRIS Aktif
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => handlePay(true)}
                        disabled={processing}
                        className="h-13 rounded-xl border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                      >
                        {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Buat Ulang Kode QRIS
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="lg"
                      onClick={() => handlePay(false)}
                      disabled={processing}
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold h-14 text-lg rounded-xl shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200 scale-[1.01] active:scale-[0.99]"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin mr-2" />
                          Menghubungi DOKU SNAP QRIS...
                        </>
                      ) : (
                        <>
                          <QrCode className="w-6 h-6 mr-2.5" />
                          Bayar Uang Kas Sekarang via QRIS
                        </>
                      )}
                    </Button>
                  )}
                </div>

                <p className="text-center text-xs text-zinc-400 flex items-center justify-center gap-1 pt-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Diolah secara otomatis dan seketika oleh sistem DOKU SNAP QRIS.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Riwayat Pembayaran Terakhir */}
      <Card className="border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl">
        <CardHeader className="flex flex-row items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800/60">
          <CardTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Riwayat Pembayaran Uang Kas
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/transactions")} className="text-indigo-600 dark:text-indigo-400">
            Lihat Semua <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {!data?.history || data.history.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              Belum ada riwayat transaksi pembayaran uang kas.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {data.history.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-5 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {t.orderItems?.[0]?.name || "Iuran Uang Kas"}
                      </p>
                      <p className="text-xs text-zinc-400 font-mono">
                        {t.trxId} • {formatDate(t.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(t.amount)}
                      </p>
                      {t.totalFee && (
                        <p className="text-[11px] text-zinc-400">
                          + MDR {formatCurrency(t.totalFee)}
                        </p>
                      )}
                    </div>
                    <Badge className={getStatusColor(t.status) + " font-bold text-xs"}>
                      {t.status}
                    </Badge>
                    {t.status === "PENDING" && t.payUrl && (
                      <Button size="sm" variant="outline" onClick={() => window.location.href = t.payUrl!} className="text-xs h-8">
                        Bayar <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
