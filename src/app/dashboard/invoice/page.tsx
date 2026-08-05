"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Loader2,
  Plus,
  Trash2,
  ExternalLink,
  Calculator,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface PaymentChannel {
  code: string;
  name: string;
  type: string;
  group: string;
  fee_flat: number;
  fee_percent: number;
  min_amount: number;
  max_amount: number;
}

interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
}

export default function InvoicePage() {
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState<{
    trxId: string;
    payUrl: string;
    channelType?: string;
    paymentInfo?: Record<string, any>;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    channel_code: "",
    amount: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
  });

  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { name: "", quantity: 1, price: 0 },
  ]);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      const res = await fetch("/api/merchant/payment-channels");
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
      }
    } catch (error) {
      console.error("Failed to fetch channels:", error);
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setSuccess(null);

    try {
      const filteredItems = orderItems.filter((item) => item.name.trim());
      if (filteredItems.length === 0) {
        alert("Pilih minimal 1 item pesanan");
        setCreating(false);
        return;
      }

      const generatedRefId = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const res = await fetch("/api/merchant/transactions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          reference_id: generatedRefId,
          return_url: `${window.location.origin}/pay`,
          order_items: filteredItems,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Find channel type to know if it's QRIS
        const selectedChannel = channels.find(c => c.code === form.channel_code);

        setSuccess({
          trxId: data.trxId,
          payUrl: data.payUrl || `${window.location.origin}/pay/${data.trxId}`,
          channelType: selectedChannel?.type,
          paymentInfo: data.paymentInfo,
        });
      } else {
        const err = await res.json();
        alert(err.error || "Gagal membuat transaksi");
      }
    } catch (error) {
      console.error("Failed to create transaction:", error);
      alert("Terjadi kesalahan");
    } finally {
      setCreating(false);
    }
  };

  const addOrderItem = () => {
    setOrderItems([...orderItems, { name: "", quantity: 1, price: 0 }]);
  };

  const removeOrderItem = (index: number) => {
    const updated = orderItems.filter((_, i) => i !== index);
    setOrderItems(updated);
    const calculatedTotal = updated.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
    if (calculatedTotal > 0) {
      setForm((prev) => ({ ...prev, amount: calculatedTotal.toString() }));
    }
  };

  const updateOrderItem = (
    index: number,
    field: keyof OrderItem,
    value: string | number
  ) => {
    const updated = [...orderItems];
    updated[index] = { ...updated[index], [field]: value };
    setOrderItems(updated);
    if (field === "price" || field === "quantity") {
      const calculatedTotal = updated.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
      if (calculatedTotal > 0) {
        setForm((prev) => ({ ...prev, amount: calculatedTotal.toString() }));
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Group channels by type
  const groupedChannels = channels.reduce(
    (acc, ch) => {
      if (!acc[ch.group]) acc[ch.group] = [];
      acc[ch.group].push(ch);
      return acc;
    },
    {} as Record<string, PaymentChannel[]>
  );

  if (success) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Invoice Berhasil Dibuat!
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                Bagikan link pembayaran ke pelanggan
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 space-y-2">
              <p className="text-xs text-zinc-400">Transaction ID</p>
              <p className="font-mono text-sm text-indigo-600 dark:text-indigo-400">
                {success.trxId}
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 space-y-2">
              <p className="text-xs text-zinc-400">Payment Link</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={success.payUrl}
                  className="flex-1 text-sm bg-transparent text-zinc-700 dark:text-zinc-300 outline-none font-mono"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(success.payUrl)}
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* QRIS Direct Display */}
            {success.channelType === "qris" && success.paymentInfo?.qr_string && (
              <div className="mt-6 flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
                  Scan QRIS untuk Membayar
                </p>
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                      success.paymentInfo.qr_string
                    )}`}
                    alt="QRIS"
                    className="w-48 h-48"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSuccess(null)}
              >
                Buat Lagi
              </Button>
              <Button className="flex-1" asChild>
                <a
                  href={success.payUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" />
                  Buka Checkout
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Buat Invoice
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Buat transaksi baru dan kirim link pembayaran ke pelanggan
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Payment Channel */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <CardTitle className="text-base">Payment Channel</CardTitle>
                <CardDescription>
                  Pilih metode pembayaran yang tersedia
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingChannels ? (
              <div className="h-10 shimmer rounded-lg" />
            ) : (
              <Select
                value={form.channel_code}
                onValueChange={(v) => {
                  setForm({ ...form, channel_code: v });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih metode pembayaran" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedChannels).map(([group, items]) => (
                    <SelectGroup key={group}>
                      <SelectLabel>{group}</SelectLabel>
                      {items.map((ch) => (
                        <SelectItem key={ch.code} value={ch.code}>
                          {ch.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="space-y-2">
              <Label>Jumlah (Rp)</Label>
              <Input
                type="number"
                placeholder="100000"
                min="1000"
                value={form.amount}
                onChange={(e) => {
                  setForm({ ...form, amount: e.target.value });
                }}
                required
              />
            </div>


          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informasi Pelanggan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input
                placeholder="John Doe"
                value={form.customer_name}
                onChange={(e) =>
                  setForm({ ...form, customer_name: e.target.value })
                }
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="john@example.com"
                  value={form.customer_email}
                  onChange={(e) =>
                    setForm({ ...form, customer_email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Telepon{" "}
                  <span className="text-zinc-400 font-normal">(opsional)</span>
                </Label>
                <Input
                  placeholder="08123456789"
                  value={form.customer_phone}
                  onChange={(e) =>
                    setForm({ ...form, customer_phone: e.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Item Pesanan{" "}
                <span className="text-red-500 font-normal text-sm">
                  (wajib minimal 1)
                </span>
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOrderItem}
              >
                <Plus className="w-4 h-4" />
                Tambah
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {orderItems.map((item, index) => (
              <div key={index} className="flex flex-wrap items-end gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200/60 dark:border-zinc-700/50 transition-all">
                <div className="flex-1 min-w-[180px] space-y-1">
                  <Label className="text-xs font-medium">Nama Produk</Label>
                  <Input
                    placeholder="T-Shirt Hitam"
                    value={item.name}
                    onChange={(e) =>
                      updateOrderItem(index, "name", e.target.value)
                    }
                    required
                  />
                </div>
                <div className="w-36 space-y-1">
                  <Label className="text-xs font-medium">Harga Satuan (Rp)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="150000"
                    value={item.price || ""}
                    onChange={(e) =>
                      updateOrderItem(index, "price", parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-xs font-medium">Qty</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateOrderItem(index, "quantity", parseInt(e.target.value) || 1)
                    }
                    required
                  />
                </div>
                {orderItems.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOrderItem(index)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Submit */}
        <Button type="submit" className="w-full" size="lg" disabled={creating}>
          {creating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Membuat Transaksi...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Buat Invoice & Payment Link
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
