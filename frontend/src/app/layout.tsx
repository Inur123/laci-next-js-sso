import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";

//  OPTIMIZED FONT LOADING
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // ⚡ Prevent FOIT (Flash of Invisible Text)
  preload: true, // ⚡ Preload critical font
  fallback: ["system-ui", "arial"], // ⚡ System fallback
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // ⚡ Don't preload non-critical fonts
  fallback: ["Courier New", "monospace"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  fallback: ["system-ui", "sans-serif"],
});

import { Toaster } from "@/components/ui/sonner";
import { Suspense } from "react";

import { RealtimeListener } from "@/components/providers/realtime-listener";
import { NextAuthProvider } from "@/components/providers/session-provider";
import { SessionMonitor } from "@/components/providers/session-monitor";

export const metadata: Metadata = {
  metadataBase: new URL("https://laci.pelajarnumagetan.or.id"),
  title: {
    template: "%s | Laci Digital",
    default: "Laci Digital - Sistem Informasi Manajemen PC IPNU IPPNU Magetan",
  },
  description:
    "Platform manajemen organisasi terintegrasi untuk PC IPNU IPPNU Kabupaten Magetan. Kelola data anggota, surat menyurat, dan administrasi dengan aman dan terenkripsi. Sistem approval otomatis dengan notifikasi email.",
  keywords: [
    "laci digital",
    "ipnu magetan",
    "ippnu magetan",
    "sistem informasi organisasi",
    "manajemen data anggota",
    "surat menyurat digital",
    "pc ipnu magetan",
    "administrasi organisasi",
    "enkripsi data",
    "role based access",
  ],
  authors: [{ name: "PC IPNU IPPNU Magetan" }],
  creator: "PC IPNU IPPNU Magetan",
  publisher: "PC IPNU IPPNU Magetan",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Laci Digital - PC IPNU IPPNU Magetan",
    description:
      "Platform manajemen organisasi terintegrasi untuk PC IPNU IPPNU Kabupaten Magetan. Kelola data anggota dan administrasi organisasi dalam satu platform.",
    url: "https://laci.pelajarnumagetan.or.id",
    siteName: "Laci Digital",
    images: [
      {
        url: "/images/logo-laci.webp",
        width: 800,
        height: 800,
        alt: "Laci Digital PC IPNU IPPNU Magetan",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Laci Digital - PC IPNU IPPNU Magetan",
    description:
      "Platform manajemen organisasi terintegrasi untuk PC IPNU IPPNU Kabupaten Magetan.",
    images: ["/images/logo-laci.webp"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

import type { Viewport } from "next";

export const viewport: Viewport = {
  colorScheme: "only light",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="light">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased`}
      >
        <NextAuthProvider>
          <RealtimeListener />
          <Suspense fallback={null}>
            <SessionMonitor />
          </Suspense>
          {children}
        </NextAuthProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
