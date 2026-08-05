"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  XCircle,
  RotateCcw,
  Loader2,
  List,
  Download,
} from "lucide-react";
import { formatDate, formatCurrency, getStatusColor, parseOrderItems } from "@/lib/utils";

interface Transaction {
  id: string;
  trxId: string;
  referenceId: string;
  amount: string;
  totalFee: string | null;
  amountReceived: string | null;
  status: string;
  channelCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  paymentInfo: Record<string, unknown> | null;
  orderItems: Array<{ name: string; quantity?: number; price?: number; subtotal?: number }> | null;
  payUrl: string | null;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string | null;
}

export default function MerchantTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState("20");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTrx, setSelectedTrx] = useState<Transaction | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: perPage,
      });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/merchant/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error("Failed to fetch:", error);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, statusFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const checkStatus = async (trxId: string) => {
    setActionLoading(trxId);
    try {
      const res = await fetch(`/api/merchant/transactions/check-status?trx_id=${trxId}`);
      if (res.ok) {
        fetchTransactions();
      }
    } catch (error) {
      console.error("Failed to check status:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const cancelTransaction = async (trxId: string) => {
    if (!confirm("Yakin ingin membatalkan transaksi ini?")) return;
    setActionLoading(trxId);
    try {
      const res = await fetch("/api/merchant/transactions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trx_id: trxId }),
      });
      if (res.ok) {
        fetchTransactions();
      } else {
        const err = await res.json();
        alert(err.error || "Gagal membatalkan");
      }
    } catch (error) {
      console.error("Failed to cancel:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    window.open(`/api/merchant/transactions/export?${params.toString()}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Riwayat Pembayaran Kas
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Pantau semua riwayat transaksi iuran kas Anda
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input
            placeholder="Cari ID transaksi, nama..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
            <SelectItem value="REFUNDED">Refunded</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={fetchTransactions}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportCSV} className="bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Transaksi</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 rounded-lg shimmer" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trx ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Barang / Produk</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead className="text-right">Total Jumlah</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-zinc-400"
                      >
                        Belum ada transaksi
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((trx) => {
                      const items = parseOrderItems(trx.orderItems, Number(trx.amount));
                      return (
                      <TableRow key={trx.id}>
                        <TableCell className="font-mono text-sm text-indigo-600 dark:text-indigo-400">
                          {trx.trxId}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">
                              {trx.customerName}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {trx.customerEmail}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {items.length > 0 ? (
                            <div className="space-y-1 max-w-[220px]">
                              {items.slice(0, 2).map((it, idx) => (
                                <div key={idx} className="text-xs text-zinc-700 dark:text-zinc-300 font-medium flex items-center justify-between gap-2">
                                  <span className="truncate">▪ {it.name}</span>
                                  <span className="text-zinc-400 font-normal shrink-0">x{it.quantity}</span>
                                </div>
                              ))}
                              {items.length > 2 && (
                                <p className="text-[11px] text-indigo-500 font-medium">+{items.length - 2} item lainnya</p>
                              )}
                              {items.length === 1 && items[0].price !== undefined && (
                                <p className="text-[11px] text-zinc-400">Harga: {formatCurrency(items[0].price)}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400 italic">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="uppercase text-xs"
                          >
                            {trx.channelCode}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(trx.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getStatusColor(trx.status)}
                          >
                            {trx.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-zinc-500 whitespace-nowrap">
                          {formatDate(trx.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {/* View / Checkout */}
                            <Button variant="ghost" size="icon" asChild>
                              <a
                                href={`/pay/${trx.trxId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Lihat Checkout"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              title="Lihat Detail Pesanan"
                              onClick={() => {
                                setSelectedTrx(trx);
                                setShowDetailDialog(true);
                              }}
                            >
                              <List className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => checkStatus(trx.trxId)}
                              disabled={actionLoading === trx.trxId}
                              title="Cek Status Pembayaran"
                            >
                              {actionLoading === trx.trxId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                            </Button>

                            {/* Cancel (QRIS + Pending only) */}
                            {trx.status === "PENDING" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cancelTransaction(trx.trxId)}
                                className="text-red-500 hover:text-red-600"
                                title="Batalkan"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-zinc-500">Tampilkan:</p>
                  <Select value={perPage} onValueChange={(v) => { setPerPage(v); setPage(1); }}>
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-zinc-500 ml-2">
                    Halaman {page} dari {totalPages}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Pesanan Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Pesanan</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 text-sm">
              <div className="text-zinc-500">Transaction ID</div>
              <div className="font-mono text-right">{selectedTrx?.trxId}</div>
              <div className="text-zinc-500">Pelanggan</div>
              <div className="text-right">{selectedTrx?.customerName}</div>
            </div>
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
              {(() => {
                const parsedItems = selectedTrx ? parseOrderItems(selectedTrx.orderItems, Number(selectedTrx.amount)) : [];
                return (
                  <>
                    <h4 className="text-sm font-semibold mb-3 flex items-center justify-between">
                      <span>Item Pesanan ({parsedItems.length} barang)</span>
                    </h4>
                    {parsedItems.length > 0 ? (
                      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-2 text-xs font-semibold text-zinc-500 grid grid-cols-12 gap-2 border-b border-zinc-200 dark:border-zinc-800">
                          <div className="col-span-6">Nama Barang</div>
                          <div className="col-span-3 text-right">Harga</div>
                          <div className="col-span-1 text-center">Qty</div>
                          <div className="col-span-2 text-right">Subtotal</div>
                        </div>
                        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {parsedItems.map((item, i) => {
                            const itemPrice = item.price;
                            const itemSubtotal = item.subtotal ?? (item.price !== undefined ? item.price * item.quantity : undefined);
                            return (
                              <div key={i} className="p-2.5 text-sm grid grid-cols-12 gap-2 items-center hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                                <div className="col-span-6 font-medium text-zinc-900 dark:text-zinc-100">{item.name}</div>
                                <div className="col-span-3 text-right text-xs text-zinc-600 dark:text-zinc-400">
                                  {itemPrice !== undefined ? formatCurrency(itemPrice) : "-"}
                                </div>
                                <div className="col-span-1 text-center font-semibold text-xs bg-zinc-100 dark:bg-zinc-800 py-0.5 rounded text-zinc-700 dark:text-zinc-300">
                                  x{item.quantity}
                                </div>
                                <div className="col-span-2 text-right font-semibold text-xs text-indigo-600 dark:text-indigo-400">
                                  {itemSubtotal !== undefined ? formatCurrency(itemSubtotal) : "-"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 text-xs flex justify-between items-center border-t border-zinc-200 dark:border-zinc-800">
                          <span className="font-semibold text-zinc-600 dark:text-zinc-400">Total Pembayaran Transaksi:</span>
                          <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{selectedTrx ? formatCurrency(selectedTrx.amount) : "-"}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500 italic p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                        Tidak ada detail barang (data lama atau tidak disertakan).
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
