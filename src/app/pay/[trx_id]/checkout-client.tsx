"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  Loader2,
  ShieldCheck,
  QrCode,
  Zap,
  ArrowLeft,
  Wallet,
  Sparkles,
  Check,
} from "lucide-react";
import { formatCurrency, parseOrderItems, formatDate } from "@/lib/utils";

interface TransactionData {
  trxId: string;
  referenceId: string;
  amount: string;
  totalFee: string | null;
  status: string;
  channelCode: string;
  customerName: string;
  customerEmail: string;
  paymentInfo: Record<string, unknown> | null;
  orderItems: Array<{ name: string; quantity?: number; price?: number; subtotal?: number }> | null;
  payUrl: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  tenantName: string;
}

export default function CheckoutClient({
  transaction: initialData,
}: {
  transaction: TransactionData;
}) {
  const router = useRouter();
  const [transaction, setTransaction] = useState(initialData);
  const [timeLeft, setTimeLeft] = useState("");
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const paymentInfo = transaction.paymentInfo || {};
  const qrContent = String(paymentInfo.qrContent || "");
  const isSimulator = Boolean(paymentInfo.isSimulator) || !paymentInfo.dokuReferenceNo;

  const subtotal = Number(transaction.amount);
  const fee = Number(transaction.totalFee || 0);
  const totalPay = subtotal + fee;

  const isSuccess = transaction.status === "PAID";
  const isPending = transaction.status === "PENDING";
  const isExpired = transaction.status === "EXPIRED" || transaction.status === "CANCELLED";

  // Auto-refresh status
  const refreshStatus = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/checkout/status?trx_id=${transaction.trxId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status) {
          setTransaction((prev) => ({
            ...prev,
            status: data.status,
            paidAt: data.paidAt || prev.paidAt,
          }));
        }
      }
    } catch (error) {
      console.error("Failed to refresh:", error);
    } finally {
      setRefreshing(false);
    }
  }, [transaction.trxId]);

  useEffect(() => {
    if (transaction.status === "PENDING") {
      const interval = setInterval(refreshStatus, 8000);
      return () => clearInterval(interval);
    }
  }, [transaction.status, refreshStatus]);

  // Countdown timer
  useEffect(() => {
    if (!transaction.expiresAt || transaction.status !== "PENDING") return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const expiry = new Date(transaction.expiresAt!).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft("Kadaluarsa");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [transaction.expiresAt, transaction.status]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simulate Payment Button (For Test/Demo Mode)
  const handleSimulatePay = async () => {
    setSimulating(true);
    try {
      const res = await fetch("/api/checkout/simulate-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trx_id: transaction.trxId }),
      });

      if (res.ok) {
        const data = await res.json();
        setTransaction((prev) => ({
          ...prev,
          status: data.status || "PAID",
          paidAt: data.paidAt || new Date().toISOString(),
        }));
      } else {
        alert("Gagal melakukan simulasi bayar.");
      }
    } catch (error) {
      console.error("Error simulate pay:", error);
      alert("Terjadi kesalahan sistem.");
    } finally {
      setSimulating(false);
    }
  };

  const getStatusBanner = () => {
    if (isSuccess) {
      return {
        bg: "from-emerald-500 to-teal-600 shadow-emerald-500/20",
        icon: <CheckCircle2 className="w-8 h-8 text-white" />,
        title: "Pembayaran Uang Kas Lunas!",
        subtitle: transaction.paidAt ? `Dilunasi pada ${formatDate(transaction.paidAt)}` : "Terima kasih atas pembayaran Anda.",
      };
    }
    if (isExpired) {
      return {
        bg: "from-red-600 to-rose-700 shadow-red-500/20",
        icon: <XCircle className="w-8 h-8 text-white" />,
        title: "Kode QRIS Kadaluarsa",
        subtitle: "Silakan kembali ke dashboard untuk membuat tagihan baru.",
      };
    }
    return {
      bg: "from-indigo-600 via-indigo-700 to-purple-800 shadow-indigo-500/20",
      icon: <QrCode className="w-8 h-8 text-white animate-pulse" />,
      title: "Menunggu Pembayaran DOKU QRIS",
      subtitle: timeLeft ? `Sisa waktu pembayaran: ${timeLeft}` : "Silakan pindai kode QR di bawah.",
    };
  };

  const banner = getStatusBanner();

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 sm:p-6 md:p-12">
      {/* Top Bar / Brand */}
      <div className="w-full max-w-lg mb-6 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard")}
          className="text-zinc-600 dark:text-zinc-300 hover:bg-white/50 dark:hover:bg-zinc-800/50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Dashboard
        </Button>
        <div className="flex items-center gap-2 font-bold text-sm text-zinc-700 dark:text-zinc-300">
          <Wallet className="w-4 h-4 text-indigo-600" /> Uang Kas Portal
        </div>
      </div>

      {/* Main Checkout Box */}
      <Card className="w-full max-w-lg rounded-3xl overflow-hidden border-0 shadow-2xl shadow-zinc-900/15 bg-white dark:bg-zinc-900">
        {/* Status Banner */}
        <div className={`p-8 text-center text-white bg-gradient-to-br ${banner.bg} shadow-lg relative overflow-hidden`}>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="flex flex-col items-center gap-3 relative z-10">
            <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-md shadow-inner">
              {banner.icon}
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">{banner.title}</h2>
              <p className="text-white/85 text-sm font-medium mt-1 font-mono">{banner.subtitle}</p>
            </div>
          </div>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Amount Section */}
          <div className="text-center py-2 border-b border-dashed border-zinc-200 dark:border-zinc-800">
            <p className="text-xs uppercase font-semibold text-zinc-400 tracking-wider">Total Yang Harus Dibayar</p>
            <p className="text-3xl sm:text-4xl font-black text-indigo-600 dark:text-indigo-400 mt-1.5 tracking-tight">
              {formatCurrency(totalPay)}
            </p>
            <div className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-full border border-purple-100 dark:border-purple-900">
              <Sparkles className="w-3 h-3" /> Termasuk biaya MDR 0,7% ({formatCurrency(fee)}) ditanggung pembayar
            </div>
          </div>

          {/* QRIS Code Box */}
          {isPending && (
            <div className="flex flex-col items-center space-y-4 py-2">
              <div className="relative p-5 bg-white rounded-3xl shadow-xl shadow-zinc-200 dark:shadow-none border-2 border-indigo-500/20 text-center flex flex-col items-center">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-zinc-800">
                  <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black">QRIS</span>
                  <span>DOKU SNAP MPM</span>
                </div>

                {qrContent ? (
                  <div className="bg-white p-2 rounded-xl">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=5&data=${encodeURIComponent(qrContent)}`}
                      alt="QRIS Code"
                      className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-lg shadow-sm"
                    />
                  </div>
                ) : (
                  <div className="w-64 h-64 flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-400">
                    <QrCode className="w-12 h-12 mb-2 animate-bounce text-indigo-500" />
                    <p className="text-xs font-medium">Memproses kode QRIS...</p>
                  </div>
                )}

                <p className="text-[11px] font-medium text-zinc-500 max-w-[240px] mt-3 leading-tight">
                  Buka aplikasi mobile banking atau e-wallet (BCA, Mandiri, BRI, Gopay, OVO, Dana) lalu pindai QR di atas.
                </p>
              </div>

              {qrContent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(qrContent)}
                  className="text-xs text-zinc-500 hover:text-indigo-600 gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "String QRIS Tersalin!" : "Salin Kode String QRIS"}
                </Button>
              )}

              {/* SIMULATOR TEST MODE BUTTON */}
              <div className="w-full pt-2">
                <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-900/50 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-400">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>Mode Pengujian & Simulasi (Demo)</span>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-normal">
                    Untuk memudahkan pengujian tanpa membayar uang asli di bank, Anda dapat langsung menekan tombol simulasi di bawah ini:
                  </p>
                  <Button
                    onClick={handleSimulatePay}
                    disabled={simulating}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs h-11 rounded-xl shadow-md transition-all scale-[1.01] active:scale-[0.99]"
                  >
                    {simulating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Mensimulasikan Bayar Lunas...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2 text-white fill-white" />
                        Simulasi Bayar Berhasil (Lunas) Sekarang!
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isSuccess && (
            <div className="py-6 text-center space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto">
                Tagihan uang kas untuk <strong className="text-zinc-900 dark:text-zinc-100">{transaction.orderItems?.[0]?.name || "periode ini"}</strong> telah selesai dibayar dan dicatat ke kas.
              </p>
              <Button
                size="lg"
                onClick={() => router.push("/dashboard")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 rounded-xl"
              >
                Kembali ke Portal Dashboard
              </Button>
            </div>
          )}

          {/* Rincian Pesanan & Biaya */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-5 space-y-3 border border-zinc-200/70 dark:border-zinc-700/60">
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Rincian Biaya Kas
            </p>
            {transaction.orderItems && transaction.orderItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{item.name}</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {formatCurrency(item.subtotal || item.price || 0)}
                </span>
              </div>
            ))}
            {!transaction.orderItems && (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">Subtotal Tagihan Uang Kas</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                  <span>Biaya MDR QRIS (0,7%)</span>
                  <span>+ {formatCurrency(fee)}</span>
                </div>
              </>
            )}

            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 flex justify-between items-center text-xs text-zinc-500 font-mono">
              <span>ID Transaksi</span>
              <span>{transaction.trxId}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-zinc-500 font-mono">
              <span>Metode Pembayaran</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">DOKU SNAP QRIS</span>
            </div>
          </div>

          {isPending && (
            <Button
              variant="outline"
              onClick={refreshStatus}
              disabled={refreshing}
              className="w-full h-11 rounded-xl text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
            >
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh Status Pembayaran Manual
            </Button>
          )}
        </CardContent>

        <CardFooter className="bg-zinc-50/80 dark:bg-zinc-900/80 border-t border-zinc-100 dark:border-zinc-800 py-4 px-6 flex justify-center text-center">
          <p className="text-xs text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Diamankan oleh DOKU SNAP Gateway & Sistem Uang Kas
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
