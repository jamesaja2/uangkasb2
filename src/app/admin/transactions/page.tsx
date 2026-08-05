"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
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
  TableFooter,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  List,
  Download,
  RotateCcw,
  Loader2,
  Wallet,
} from "lucide-react";
import { formatDate, formatCurrency, getStatusColor, parseOrderItems } from "@/lib/utils";

interface Transaction {
  id: string;
  trxId: string;
  referenceId: string;
  amount: string;
  totalFee: string | null;
  status: string;
  channelCode: string;
  customerName: string;
  customerEmail: string;
  tenant: { name: string } | null;
  createdAt: string;
  paidAt: string | null;
  orderItems: Array<{ name: string; quantity?: number; price?: number; subtotal?: number }> | null;
}

interface Stats {
  totalVolume: number;
  totalPlatformFee: number;
  totalTransactions: number;
  successRate: number;
  pendingCount: number;
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalVolume: 0,
    totalPlatformFee: 0,
    totalTransactions: 0,
    successRate: 0,
    pendingCount: 0,
  });
  const [filteredTotal, setFilteredTotal] = useState({ amount: 0, amountReceived: 0, platformFee: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState("20");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [tenants, setTenants] = useState<{id: string; name: string}[]>([]);
  const [selectedTrx, setSelectedTrx] = useState<Transaction | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: perPage,
      });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (tenantFilter !== "all") params.set("tenantId", tenantFilter);
      if (dateRange?.from) params.set("dateFrom", format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange?.to) params.set("dateTo", format(dateRange.to, "yyyy-MM-dd"));

      const res = await fetch(`/api/admin/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setTotalPages(data.totalPages || 1);
        setStats(data.stats || stats);
        if (data.filteredTotal) {
          setFilteredTotal(data.filteredTotal);
        }
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, statusFilter, tenantFilter, dateRange]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const res = await fetch("/api/admin/tenants");
        if (res.ok) {
          const data = await res.json();
          setTenants(data.tenants || []);
        }
      } catch (error) {
        console.error("Failed to fetch tenants:", error);
      }
    };
    fetchTenants();
  }, []);

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (tenantFilter !== "all") params.set("tenantId", tenantFilter);
    if (dateRange?.from) params.set("dateFrom", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange?.to) params.set("dateTo", format(dateRange.to, "yyyy-MM-dd"));

    window.location.href = `/api/admin/transactions/export?${params.toString()}`;
  };

  const handleBulkCheckStatus = async (trxIds: string[]) => {
    if (trxIds.length === 0) return;
    setBulkActionLoading(true);
    try {
      const res = await fetch("/api/admin/transactions/bulk-check-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trxIds }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Berhasil: ${data.summary.success}, Gagal: ${data.summary.failed}`);
        setSelectedRowIds([]);
        fetchTransactions();
      } else {
        alert(data.error || "Gagal refresh status massal");
      }
    } catch (error) {
      console.error("Failed to bulk check status:", error);
    } finally {
      setBulkActionLoading(false);
      setActionLoading(null);
    }
  };

  const statCards = [
    {
      label: "Total Volume",
      value: formatCurrency(stats.totalVolume),
      icon: DollarSign,
      color: "text-indigo-500",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/50",
    },
    {
      label: "Total Pemasukan (Fee)",
      value: formatCurrency(stats.totalPlatformFee),
      icon: Wallet,
      color: "text-sky-500",
      bgColor: "bg-sky-50 dark:bg-sky-950/50",
    },
    {
      label: "Total Transaksi",
      value: stats.totalTransactions.toLocaleString(),
      icon: TrendingUp,
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950/50",
    },
    {
      label: "Success Rate",
      value: `${stats.successRate.toFixed(1)}%`,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
    },
    {
      label: "Pending",
      value: stats.pendingCount.toLocaleString(),
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-950/50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Transaksi Pembayaran Kas
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Monitor seluruh pembayaran uang kas dari semua anggota
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="stat-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}
                >
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input
            placeholder="Cari transaksi..."
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
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="REFUNDED">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={tenantFilter}
          onValueChange={(v) => {
            setTenantFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Pilih Tenant" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tenant</SelectItem>
            {tenants.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DatePickerWithRange
          date={dateRange}
          setDate={(newDate) => {
            setDateRange(newDate);
            setPage(1);
          }}
        />

        <div className="flex gap-2 ml-auto">
          {selectedRowIds.length > 0 && (
            <Button
              variant="default"
              onClick={() => handleBulkCheckStatus(selectedRowIds)}
              disabled={bulkActionLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
            >
              {bulkActionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Refresh Status ({selectedRowIds.length})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
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
                    <TableHead className="w-12">
                      <Checkbox
                        checked={transactions.length > 0 && selectedRowIds.length === transactions.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRowIds(transactions.map(t => t.trxId));
                          } else {
                            setSelectedRowIds([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Trx ID</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Barang / Produk</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={10}
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
                        <TableCell>
                          <Checkbox
                            checked={selectedRowIds.includes(trx.trxId)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedRowIds([...selectedRowIds, trx.trxId]);
                              } else {
                                setSelectedRowIds(selectedRowIds.filter(id => id !== trx.trxId));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm text-indigo-600 dark:text-indigo-400">
                          {trx.trxId}
                        </TableCell>
                        <TableCell className="text-sm">
                          {trx.tenant?.name || "—"}
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
                          <Badge variant="secondary" className="uppercase text-xs">
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
                          <div className="flex gap-2">
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
                              asChild
                              title="Buka Halaman Checkout"
                            >
                              <a
                                href={`/pay/${trx.trxId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </Button>

                            {/* Single Refresh Status */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleBulkCheckStatus([trx.trxId])}
                              disabled={actionLoading === trx.trxId}
                              className="text-blue-500 hover:text-blue-600"
                              title="Refresh Status"
                            >
                              {actionLoading === trx.trxId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={6} className="text-right font-bold text-zinc-900 dark:text-zinc-100 py-3">
                      Total Masuk Paymenku (Gross):
                    </TableCell>
                    <TableCell className="text-right font-bold text-zinc-900 dark:text-zinc-100 py-3">
                      {formatCurrency(filteredTotal.amountReceived)}
                    </TableCell>
                    <TableCell colSpan={3}></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={6} className="text-right font-bold text-sky-600 dark:text-sky-500 py-3 border-t-0">
                      Pemasukan Admin (Platform Fee):
                    </TableCell>
                    <TableCell className="text-right font-bold text-sky-600 dark:text-sky-500 py-3 border-t-0">
                      {formatCurrency(filteredTotal.platformFee)}
                    </TableCell>
                    <TableCell colSpan={3}></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={6} className="text-right font-bold text-emerald-600 dark:text-emerald-500 py-3 border-t-0">
                      Total Hak Merchant (Net):
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-500 py-3 border-t-0">
                      {formatCurrency(filteredTotal.amount)}
                    </TableCell>
                    <TableCell colSpan={3}></TableCell>
                  </TableRow>
                </TableFooter>
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
