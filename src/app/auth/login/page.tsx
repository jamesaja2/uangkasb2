"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setError("Gagal menghubungkan ke Google.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 p-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-white border border-zinc-200 shadow-sm p-2">
            <Image src="/logo.png" alt="Logo" width={44} height={44} className="object-contain" />
          </div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-3">Portal Uang Kas</h1>
          <p className="text-xs text-zinc-500">Masuk ke akun untuk melihat & membayar kas</p>
        </div>

        <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-lg overflow-hidden">
          <CardHeader className="space-y-1 pb-4 pt-5 px-6">
            <CardTitle className="text-base font-semibold text-center">Masuk ke Akun</CardTitle>
            <CardDescription className="text-center text-xs">
              Pilih metode masuk yang Anda inginkan
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs">
                {error}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full h-10 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-800 hover:bg-zinc-50 font-medium text-xs rounded-md shadow-2xs flex items-center justify-center gap-2"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              Masuk dengan Google
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-semibold">
                <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-400">
                  Atau dengan email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@paymentbyjames.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-9 text-xs rounded-md border-zinc-300 dark:border-zinc-700"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10 h-9 text-xs rounded-md border-zinc-300 dark:border-zinc-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-9 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium text-xs rounded-md mt-2 shadow-none"
                disabled={loading || googleLoading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                    Memproses...
                  </>
                ) : (
                  "Masuk"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-zinc-400 mt-6">
          © 2026 Uang Kas Portal byJames
        </p>
      </div>
    </div>
  );
}
