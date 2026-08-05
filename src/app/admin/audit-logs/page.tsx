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
import { Button } from "@/components/ui/button";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
} from "lucide-react";
import { formatDate, getStatusColor } from "@/lib/utils";

interface AuditLog {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  target: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  status: string;
  createdAt: string;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "20",
      });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);

      const res = await fetch(`/api/admin/audit-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      "user.login": "Login",
      "user.create": "Buat User",
      "user.update": "Update User",
      "user.delete": "Hapus User",
      "user.suspend": "Suspend User",
      "settings.update": "Update Setting",
      "transaction.create": "Buat Transaksi",
      "transaction.cancel": "Cancel Transaksi",
      "transaction.refund": "Refund Transaksi",
      "webhook.received": "Webhook Diterima",
    };
    return labels[action] || action;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Audit Log
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Riwayat semua aktivitas di platform
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input
            placeholder="Cari user..."
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
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="SUCCESS">Success</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={actionFilter}
          onValueChange={(v) => {
            setActionFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <FileText className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Jenis Aktivitas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Aktivitas</SelectItem>
            <SelectItem value="user.login">Login</SelectItem>
            <SelectItem value="user.create">Buat User</SelectItem>
            <SelectItem value="user.update">Update User</SelectItem>
            <SelectItem value="user.delete">Hapus User</SelectItem>
            <SelectItem value="settings.update">Update Setting</SelectItem>
            <SelectItem value="transaction.create">Buat Transaksi</SelectItem>
            <SelectItem value="webhook.received">Webhook</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aktivitas Terbaru</CardTitle>
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
                    <TableHead>Waktu</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Aktivitas</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-zinc-400"
                      >
                        Belum ada aktivitas
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <>
                        <TableRow
                          key={log.id}
                          className="cursor-pointer"
                          onClick={() =>
                            setExpandedRow(
                              expandedRow === log.id ? null : log.id
                            )
                          }
                        >
                          <TableCell className="text-sm text-zinc-500 whitespace-nowrap">
                            {formatDate(log.createdAt)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.userName || "System"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {getActionLabel(log.action)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-zinc-500 text-sm font-mono">
                            {log.target || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getStatusColor(log.status)}
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-zinc-400 text-xs font-mono">
                            {log.ipAddress || "—"}
                          </TableCell>
                        </TableRow>
                        {expandedRow === log.id && log.details && (
                          <TableRow key={`${log.id}-details`}>
                            <TableCell
                              colSpan={6}
                              className="bg-zinc-50 dark:bg-zinc-800/50"
                            >
                              <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap max-h-40 overflow-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-sm text-zinc-500">
                  Halaman {page} dari {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
