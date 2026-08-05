"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Key,
  Save,
  Loader2,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  Wallet,
  QrCode,
  Calendar,
  AlertCircle,
} from "lucide-react";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showLiveKey, setShowLiveKey] = useState(false);
  const [showTestKey, setShowTestKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const [settings, setSettings] = useState({
    // Uang Kas Settings
    uangkas_harga_dasar: "50000",
    uangkas_tanggal_deadline: "10",
    uangkas_denda: "5000",

    // DOKU SNAP QRIS Settings
    doku_client_id: "",
    doku_merchant_id: "",
    doku_client_secret: "",
    doku_terminal_id: "A01",
    doku_is_production: "false",
    doku_token_b2b: "",

    // Legacy Paymenku Settings
    apiKeyLive: "",
    apiKeyTest: "",
    webhookSecret: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings({
          uangkas_harga_dasar: data.uangkas_harga_dasar || "50000",
          uangkas_tanggal_deadline: data.uangkas_tanggal_deadline || "10",
          uangkas_denda: data.uangkas_denda || "5000",
          doku_client_id: data.doku_client_id || "",
          doku_merchant_id: data.doku_merchant_id || "",
          doku_client_secret: data.doku_client_secret || "",
          doku_terminal_id: data.doku_terminal_id || "A01",
          doku_is_production: data.doku_is_production || "false",
          doku_token_b2b: data.doku_token_b2b || "",
          apiKeyLive: data.apiKeyLive || "",
          apiKeyTest: data.apiKeyTest || "",
          webhookSecret: data.webhookSecret || "",
        });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
      } else {
        alert("Gagal menyimpan konfigurasi.");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Terjadi kesalahan koneksi.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Pengaturan Sistem Uang Kas & QRIS
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Konfigurasi iuran bulanan dan integrasi DOKU SNAP QRIS
          </p>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-3xl shimmer bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl pb-16">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Pengaturan Uang Kas & Payment Gateway
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Sesuaikan nominal uang kas, batas waktu keterlambatan (deadline), serta kredensial DOKU SNAP QRIS
        </p>
      </div>

      {success && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 text-emerald-600 dark:text-emerald-400 font-medium text-sm shadow-md animate-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          Semua konfigurasi Uang Kas & DOKU QRIS berhasil diperbarui!
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Card Konfigurasi Uang Kas */}
        <Card className="border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl overflow-hidden shadow-lg shadow-zinc-900/5">
          <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/40 px-6 sm:px-8 py-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Konfigurasi Tagihan Uang Kas</CardTitle>
                <CardDescription>
                  Pengaturan harga dasar iuran kas, tanggal jatuh tempo, dan denda terlambat
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="uangkas_harga_dasar" className="font-semibold text-zinc-800 dark:text-zinc-200">
                  Harga Dasar (Rp / bulan)
                </Label>
                <Input
                  id="uangkas_harga_dasar"
                  type="number"
                  placeholder="50000"
                  value={settings.uangkas_harga_dasar}
                  onChange={(e) => setSettings({ ...settings, uangkas_harga_dasar: e.target.value })}
                  className="font-mono text-base h-12 rounded-xl"
                  required
                />
                <p className="text-[11px] text-zinc-500">
                  Nominal pokok uang kas per bulan sebelum dikenakan denda dan MDR.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="uangkas_tanggal_deadline" className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-500" /> Tanggal Deadline (1-31)
                </Label>
                <Input
                  id="uangkas_tanggal_deadline"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="10"
                  value={settings.uangkas_tanggal_deadline}
                  onChange={(e) => setSettings({ ...settings, uangkas_tanggal_deadline: e.target.value })}
                  className="font-mono text-base h-12 rounded-xl"
                  required
                />
                <p className="text-[11px] text-zinc-500">
                  Jika tanggal saat ini melebih batas hari ini, pembayar diketuk denda.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="uangkas_denda" className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-500" /> Denda Keterlambatan (Rp)
                </Label>
                <Input
                  id="uangkas_denda"
                  type="number"
                  placeholder="5000"
                  value={settings.uangkas_denda}
                  onChange={(e) => setSettings({ ...settings, uangkas_denda: e.target.value })}
                  className="font-mono text-base h-12 rounded-xl"
                  required
                />
                <p className="text-[11px] text-zinc-500">
                  Denda flat yang otomatis ditambahkan bila terlambat melunasi.
                </p>
              </div>
            </div>

            <div className="bg-indigo-50/60 dark:bg-indigo-950/20 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-900/40 flex items-start gap-3">
              <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                <strong className="block mb-0.5 font-bold">Aturan MDR 0,7% (Ditanggung Pembayar):</strong>
                Sesuai ketentuan, biaya MDR QRIS tepat 0,7% akan dikalikan dengan (Harga Dasar + Denda jika ada) dan otomatis ditambahkan ke total tagihan pada laman pembayaran anggota.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card DOKU SNAP QRIS Gateway */}
        <Card className="border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl overflow-hidden shadow-lg shadow-zinc-900/5">
          <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800/60 px-6 sm:px-8 py-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-bold">DOKU SNAP QRIS Gateway</CardTitle>
                  <Badge variant={settings.doku_is_production === "true" ? "success" : "warning"} className="text-[10px] uppercase font-bold">
                    {settings.doku_is_production === "true" ? "Production" : "Sandbox / Simulator"}
                  </Badge>
                </div>
                <CardDescription>
                  Integrasi SNAP QRIS MPM Generate & Query sesuai spesifikasi panduan resmi
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="doku_is_production" className="font-semibold">Lingkungan Kerja (Environment)</Label>
                <Select
                  value={settings.doku_is_production}
                  onValueChange={(val) => setSettings({ ...settings, doku_is_production: val })}
                >
                  <SelectTrigger className="h-12 rounded-xl font-medium">
                    <SelectValue placeholder="Pilih Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Sandbox / Simulator Test Mode (Sangat Disarankan untuk Demo)</SelectItem>
                    <SelectItem value="true">Live Production (API Resmi DOKU)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="doku_terminal_id" className="font-semibold">Terminal ID</Label>
                <Input
                  id="doku_terminal_id"
                  type="text"
                  placeholder="A01"
                  value={settings.doku_terminal_id}
                  onChange={(e) => setSettings({ ...settings, doku_terminal_id: e.target.value })}
                  className="font-mono text-sm h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doku_client_id" className="font-semibold">Client ID / Partner ID (X-PARTNER-ID)</Label>
                <Input
                  id="doku_client_id"
                  type="text"
                  placeholder="BR-xxxxx atau Client ID Anda"
                  value={settings.doku_client_id}
                  onChange={(e) => setSettings({ ...settings, doku_client_id: e.target.value })}
                  className="font-mono text-sm h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doku_merchant_id" className="font-semibold">Merchant ID (MALL_ID)</Label>
                <Input
                  id="doku_merchant_id"
                  type="text"
                  placeholder="100xxxxx"
                  value={settings.doku_merchant_id}
                  onChange={(e) => setSettings({ ...settings, doku_merchant_id: e.target.value })}
                  className="font-mono text-sm h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doku_client_secret" className="font-semibold">Secret Key (Untuk HMAC-SHA512)</Label>
                <div className="relative">
                  <Input
                    id="doku_client_secret"
                    type={showSecret ? "text" : "password"}
                    placeholder="Masukkan Secret Key..."
                    value={settings.doku_client_secret}
                    onChange={(e) => setSettings({ ...settings, doku_client_secret: e.target.value })}
                    className="pr-10 font-mono text-sm h-12 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="doku_token_b2b" className="font-semibold">Token B2B (Bearer Access Token)</Label>
                <div className="relative">
                  <Input
                    id="doku_token_b2b"
                    type={showToken ? "text" : "password"}
                    placeholder="eyJhbGciOi..."
                    value={settings.doku_token_b2b}
                    onChange={(e) => setSettings({ ...settings, doku_token_b2b: e.target.value })}
                    className="pr-10 font-mono text-sm h-12 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
              💡 <strong>Catatan Simulator Mode:</strong> Jika Anda tidak mengisikan kredensial asli DOKU atau jika jaringan tidak tersambung ke server produksi bank, sistem secara otomatis beralih ke <strong>DOKU Simulator Mode</strong>, memungkinkan Anda meninjau QRIS, menghitung MDR 0,7%, dan mensimulasikan pembayaran langsung di layar checkout.
            </div>
          </CardContent>
        </Card>

        {/* Legacy Paymenku Card (Disembunyikan Opsional) */}
        <Card className="border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl opacity-75 hover:opacity-100 transition-opacity">
          <CardHeader className="px-6 sm:px-8 py-5 border-b border-zinc-100 dark:border-zinc-800/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <Key className="w-5 h-5 text-zinc-500" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Gateway Lama (Paymenku Legacy)</CardTitle>
                <CardDescription className="text-xs">
                  Kredensial lama untuk menjaga kompatibilitas riwayat transaksi masa lalu
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="apiKeyLive" className="text-xs">Production API Key</Label>
                <div className="relative">
                  <Input
                    id="apiKeyLive"
                    type={showLiveKey ? "text" : "password"}
                    value={settings.apiKeyLive}
                    onChange={(e) => setSettings({ ...settings, apiKeyLive: e.target.value })}
                    className="pr-10 font-mono text-xs h-10 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLiveKey(!showLiveKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                  >
                    {showLiveKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKeyTest" className="text-xs">Sandbox API Key</Label>
                <div className="relative">
                  <Input
                    id="apiKeyTest"
                    type={showTestKey ? "text" : "password"}
                    value={settings.apiKeyTest}
                    onChange={(e) => setSettings({ ...settings, apiKeyTest: e.target.value })}
                    className="pr-10 font-mono text-xs h-10 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTestKey(!showTestKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                  >
                    {showTestKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhookSecret" className="text-xs">Webhook Secret (HMAC-SHA256)</Label>
              <div className="relative">
                <Input
                  id="webhookSecret"
                  type={showWebhookSecret ? "text" : "password"}
                  value={settings.webhookSecret}
                  onChange={(e) => setSettings({ ...settings, webhookSecret: e.target.value })}
                  className="pr-10 font-mono text-xs h-10 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                >
                  {showWebhookSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button
          type="submit"
          disabled={saving}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold h-14 text-lg rounded-2xl shadow-xl shadow-indigo-500/25 transition-all duration-200 scale-[1.01] active:scale-[0.99]"
        >
          {saving ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Menyimpan Konfigurasi...
            </>
          ) : (
            <>
              <Save className="w-6 h-6 mr-2.5" />
              Simpan Semua Pengaturan Uang Kas
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
