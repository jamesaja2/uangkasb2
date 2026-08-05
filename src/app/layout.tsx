import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Payment byJames — Multi-Tenant Payment Aggregator",
  description:
    "Platform payment aggregator multi-tenant yang terintegrasi dengan Paymenku untuk pengelolaan transaksi digital yang aman dan efisien.",
  keywords: ["payment", "aggregator", "multi-tenant", "paymenku", "indonesia"],
  authors: [{ name: "Payment byJames" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-zinc-50 dark:bg-zinc-950 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
