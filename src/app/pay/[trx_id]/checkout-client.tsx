"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Copy,
  RefreshCw,
  Loader2,
  ArrowLeft,
  Check,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

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
  const isSimulator = Boolean(paymentInfo.isSimulator) || !paymentInfo.dokuReferenceNo || String(paymentInfo.dokuReferenceNo).startsWith("SIM-");

  const subtotal = Number(transaction.amount);
  const fee = Number(transaction.totalFee || 0);
  const totalPay = subtotal + fee;

  const isSuccess = transaction.status === "PAID";
  const isPending = transaction.status === "PENDING";
  const isExpired = transaction.status === "EXPIRED" || transaction.status === "CANCELLED";

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
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [transaction.expiresAt, transaction.status]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulatePay = async () => {
    setSimulating(true);
    try {
      const res = await fetch("/api/checkout/simulate", {
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard")}
          className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 -ml-2"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Kembali ke Dashboard
        </Button>
      </div >

      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm overflow-hidden">
        {/* Header (Clean, flat, no gradients) */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-100/60 dark:bg-zinc-800/40">
          <div>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Pembayaran Uang Kas</h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">ID: {transaction.trxId}</p>
          </div>
          <Badge
            variant={isSuccess ? "success" : isExpired ? "destructive" : "warning"}
            className="text-xs uppercase px-2 py-0.5 rounded font-medium"
          >
            {isSuccess ? "Lunas" : isExpired ? "Kadaluarsa" : "Menunggu Bayar"}
          </Badge>
        </div>

        <div className="p-6 space-y-6">
          {/* Amount Box */}
          <div className="text-center py-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200/60 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Total Pembayaran</p>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              {formatCurrency(totalPay)}
            </p>
            {fee > 0 && (
              <p className="text-xs text-zinc-500 mt-1">
                Termasuk biaya MDR QRIS (0,7%)
              </p>
            )}
          </div>

          {/* QRIS Code Section for PENDING */}
          {isPending && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center p-4 border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-800/50">
                <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                  Scan QRIS (BCA, Mandiri, Dana, OVO, dll)
                </div>

                {qrContent ? (
                  <div className="bg-white p-2 rounded border border-zinc-100 dark:border-zinc-700 shadow-sm">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=5&data=${encodeURIComponent(qrContent)}`}
                      alt="QRIS Code"
                      className="w-52 h-52 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-400 text-xs">
                    Memuat kode QR...
                  </div>
                )}

                <p className="text-xs text-zinc-500 mt-3 text-center">
                  {timeLeft ? `Sisa waktu pembayaran: ${timeLeft}` : "Pindai kode untuk menyelesaikan pembayaran"}
                </p>
              </div>

              <div className="space-y-2">
                {qrContent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(qrContent)}
                    className="w-full text-xs h-9 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-normal"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                    {copied ? "String QRIS berhasil disalin" : "Salin Kode String QRIS"}
                  </Button>
                )}

                {isSimulator && (
                  <Button
                    onClick={handleSimulatePay}
                    disabled={simulating}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 font-medium text-xs h-9 rounded-md shadow-none"
                  >
                    {simulating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                        Memproses...
                      </>
                    ) : (
                      "Simulasi Bayar Lunas (Test Mode)"
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Success screen */}
          {isSuccess && (
            <div className="text-center py-4 space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Tagihan ini telah dinyatakan lunas dan berhasil dicatat.
              </p>
              {transaction.paidAt && (
                <p className="text-xs text-zinc-400">
                  Tanggal lunas: {formatDate(transaction.paidAt)}
                </p>
              )}
              <Button
                onClick={() => router.push("/dashboard")}
                className="w-full h-9 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium mt-2"
              >
                Kembali ke Dashboard
              </Button>
            </div>
          )}

          {/* Expired screen */}
          {isExpired && (
            <div className="text-center py-4 space-y-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Tagihan ini sudah kadaluarsa atau dibantalkan.
              </p>
              <Button
                onClick={() => router.push("/dashboard")}
                className="w-full h-9 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium mt-2"
              >
                Buat Tagihan Baru di Dashboard
              </Button>
            </div>
          )}

          {/* Order items and breakdown */}
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-2">
            <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Rincian Tagihan</h4>
            <div className="space-y-1.5 text-sm">
              {transaction.orderItems ? (
                transaction.orderItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-zinc-600 dark:text-zinc-400 text-xs">
                    <span>{item.name}</span>
                    <span>{formatCurrency(item.subtotal || item.price || 0)}</span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400 text-xs">
                  <span>Subtotal Uang Kas</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
              )}
              {fee > 0 && (
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400 text-xs">
                  <span>Biaya MDR QRIS (0,7%)</span>
                  <span>{formatCurrency(fee)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-900 dark:text-zinc-100 font-semibold text-sm pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800">
                <span>Total Bayar</span>
                <span>{formatCurrency(totalPay)}</span>
              </div>
            </div>
          </div>

          {isPending && (
            <div className="pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshStatus}
                disabled={refreshing}
                className="w-full text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-normal"
              >
                {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                Cek Status Pembayaran
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400">
          Metode: DOKU SNAP QRIS
        </div>
      </div>
    </div>
  );
}
