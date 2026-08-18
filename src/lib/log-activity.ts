"use server";

import prisma from "@/lib/prisma";
import { LogAction, LogModule } from "@prisma/client";
import { notifyRealtime } from "@/lib/realtime";
import { getSession } from "@/lib/auth-session";
import { headers, cookies } from "next/headers";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Parse Browser dari User-Agent string (tanpa library tambahan)
// ─────────────────────────────────────────────────────────────────────────────
function parseBrowser(ua: string): string {
  if (!ua) return "Unknown";
  if (/Edg\/|EdgA\/|Edge\//.test(ua)) return "Microsoft Edge";
  if (/OPR\/|Opera\//.test(ua)) return "Opera";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Browser";
  if (/UCBrowser\//.test(ua)) return "UC Browser";
  if (/YaBrowser\//.test(ua)) return "Yandex Browser";
  if (/Firefox\//.test(ua)) return "Mozilla Firefox";
  if (/Chrome\//.test(ua) && !/Chromium\//.test(ua)) return "Google Chrome";
  if (/Chromium\//.test(ua)) return "Chromium";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Apple Safari";
  return "Unknown Browser";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Parse Device dari User-Agent string
// ─────────────────────────────────────────────────────────────────────────────
function parseDevice(ua: string): string {
  if (!ua) return "Unknown";
  if (/iPhone/.test(ua)) return "Mobile – iPhone (iOS)";
  if (/iPad/.test(ua)) return "Tablet – iPad (iOS)";
  if (/iPod/.test(ua)) return "Mobile – iPod (iOS)";
  if (/Android/.test(ua) && /Mobile/.test(ua)) return "Mobile – Android";
  if (/Android/.test(ua)) return "Tablet – Android";
  if (/Windows Phone/.test(ua)) return "Mobile – Windows Phone";
  if (/Macintosh|Mac OS X/.test(ua)) return "Desktop – macOS";
  if (/Windows NT/.test(ua)) return "Desktop – Windows";
  if (/Linux/.test(ua)) return "Desktop – Linux";
  if (/CrOS/.test(ua)) return "Desktop – ChromeOS";
  return "Desktop";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Ambil info perangkat dari request headers
// ─────────────────────────────────────────────────────────────────────────────
async function getClientInfo(): Promise<{
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  device?: string;
  latitude?: string;
  longitude?: string;
  gpsAddress?: string;
}> {
  try {
    const headersList = await headers();
    const cookieStore = await cookies();

    const lat = cookieStore.get("user_lat")?.value;
    const lng = cookieStore.get("user_lng")?.value;
    const addr = cookieStore.get("user_address")?.value;

    const forwarded = headersList.get("x-forwarded-for");
    const realIp = headersList.get("x-real-ip");
    const ipRaw = forwarded ? forwarded.split(",")[0].trim() : (realIp ?? undefined);

    // Abaikan localhost IP
    const ipAddress =
      ipRaw && ipRaw !== "::1" && ipRaw !== "127.0.0.1" ? ipRaw : undefined;

    const userAgent = headersList.get("user-agent") ?? undefined;
    const browser = userAgent ? parseBrowser(userAgent) : undefined;
    const device = userAgent ? parseDevice(userAgent) : undefined;

    return {
      ipAddress,
      userAgent,
      browser,
      device,
      latitude: lat,
      longitude: lng,
      gpsAddress: addr ? decodeURIComponent(addr) : undefined,
    };
  } catch {
    // Konteks request tidak tersedia (misal: cron job, batch process)
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Ambil lokasi geografis berdasarkan IP (menggunakan freeipapi.com)
// ─────────────────────────────────────────────────────────────────────────────
async function getLocationFromIp(ip: string): Promise<string | undefined> {
  try {
    const res = await fetch(`https://freeipapi.com/api/json/${ip}`, {
      signal: AbortSignal.timeout(3000), // timeout 3 detik
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    
    // Format response FreeIPAPI: cityName, regionName, countryName
    return [data.cityName, data.regionName, data.countryName]
      .filter(Boolean)
      .join(", ");
  } catch (error) {
    console.error("[Logger] FreeIPAPI lookup failed:", error);
    return undefined;
  }
}

/**
 * HIGH-PERFORMANCE NON-BLOCKING LOGGER
 *
 * Fungsi ini didesain khusus untuk Vercel + Remote VPS agar proses utama
 * (Login, Register, CRUD) tetap instan meskipun jarak database jauh.
 */
export async function createLog(
  action: LogAction,
  module: LogModule,
  description: string,
  entityId?: string,
) {
  // 1. Ambil session dulu (biasanya cepat karena dari cookie/cache)
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    console.warn("[Logger] Gagal catat log: User tidak terautentikasi.");
    return;
  }

  // 2. Ambil info perangkat dari headers (cepat, dari request context)
  const clientInfo = await getClientInfo();

  // 3. JALANKAN DI BACKGROUND (Non-blocking)
  // Kita tidak menggunakan 'await' di sini agar fungsi langsung selesai (Return Fast)
  (async () => {
    try {
      // Optimasi: Ambil periode aktif sekali jalan
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          periodeAktifId: true,
          periodes: {
            where: { isActive: true },
            take: 1,
            select: { id: true },
          },
        },
      });

      const periodeId = user?.periodeAktifId || user?.periodes[0]?.id;
      if (!periodeId) return;

      // Ambil lokasi geografis dari GPS cookies / fallback ke IP
      let location: string | undefined;
      if (clientInfo.latitude && clientInfo.longitude) {
        if (clientInfo.gpsAddress) {
          location = `${clientInfo.gpsAddress} (${clientInfo.latitude}, ${clientInfo.longitude})`;
        } else {
          location = `${clientInfo.latitude}, ${clientInfo.longitude}`;
        }
      } else if (clientInfo.ipAddress) {
        location = await getLocationFromIp(clientInfo.ipAddress);
      }

      // Catat log ke database
      await prisma.logActivity.create({
        data: {
          userId,
          periodeId,
          action,
          module,
          description,
          entityId,
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
          browser: clientInfo.browser,
          device: clientInfo.device,
          location,
        },
      });

      // Notifikasi realtime (Fire and forget)
      notifyRealtime({
        type: "log",
        action,
        module,
        description,
        entityId,
      }).catch(() => {});
    } catch (err) {
      console.error("[Logger] Background logging failed:", err);
    }
  })();

  // Fungsi akan langsung selesai di sini, tanpa menunggu proses di atas beres.
  return;
}

/**
 * MANUAL NON-BLOCKING LOGGER
 */
export async function createLogManual(
  userId: string,
  action: LogAction,
  module: LogModule,
  description: string,
  entityId?: string,
) {
  // Ambil info perangkat dari headers
  const clientInfo = await getClientInfo();

  // Jalankan langsung di background
  (async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          periodeAktifId: true,
          periodes: {
            where: { isActive: true },
            take: 1,
            select: { id: true },
          },
        },
      });

      const periodeId = user?.periodeAktifId || user?.periodes[0]?.id;
      if (!periodeId) return;

      // De-duplikasi AUTH (agar tidak banjir log saat login)
      if (module === "AUTH") {
        const existing = await prisma.logActivity.findFirst({
          where: {
            userId,
            module: "AUTH",
            action,
            createdAt: { gte: new Date(Date.now() - 3000) },
          },
          select: { id: true },
        });
        if (existing) return;
      }

      // Ambil lokasi geografis dari GPS cookies / fallback ke IP
      let location: string | undefined;
      if (clientInfo.latitude && clientInfo.longitude) {
        if (clientInfo.gpsAddress) {
          location = `${clientInfo.gpsAddress} (${clientInfo.latitude}, ${clientInfo.longitude})`;
        } else {
          location = `${clientInfo.latitude}, ${clientInfo.longitude}`;
        }
      } else if (clientInfo.ipAddress) {
        location = await getLocationFromIp(clientInfo.ipAddress);
      }

      await prisma.logActivity.create({
        data: {
          userId,
          periodeId,
          action,
          module,
          description,
          entityId,
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
          browser: clientInfo.browser,
          device: clientInfo.device,
          location,
        },
      });

      notifyRealtime({
        type: "log",
        action,
        module,
        description,
        entityId,
      }).catch(() => {});
    } catch (err) {
      console.error("[Logger Manual] Background logging failed:", err);
    }
  })();

  return;
}

/**
 * BATCH LOGGER (Juga Non-blocking)
 */
export async function createBatchLogs(
  logs: Array<{
    action: LogAction;
    module: LogModule;
    description: string;
    entityId?: string;
  }>,
) {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId || logs.length === 0) return;

  // Ambil info perangkat dari headers
  const clientInfo = await getClientInfo();

  (async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          periodeAktifId: true,
          periodes: { where: { isActive: true }, take: 1, select: { id: true } },
        },
      });

      const periodeId = user?.periodeAktifId || user?.periodes[0]?.id;
      if (!periodeId) return;

      // Ambil lokasi geografis dari GPS cookies / fallback ke IP (satu kali untuk semua batch)
      let location: string | undefined;
      if (clientInfo.latitude && clientInfo.longitude) {
        if (clientInfo.gpsAddress) {
          location = `${clientInfo.gpsAddress} (${clientInfo.latitude}, ${clientInfo.longitude})`;
        } else {
          location = `${clientInfo.latitude}, ${clientInfo.longitude}`;
        }
      } else if (clientInfo.ipAddress) {
        location = await getLocationFromIp(clientInfo.ipAddress);
      }

      await prisma.logActivity.createMany({
        data: logs.map((log) => ({
          userId,
          periodeId,
          action: log.action,
          module: log.module,
          description: log.description,
          entityId: log.entityId,
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
          browser: clientInfo.browser,
          device: clientInfo.device,
          location,
        })),
      });

      notifyRealtime({ type: "log", module: logs[0]?.module }).catch(() => {});
    } catch (err) {
      console.error("[Batch Logger] Background logging failed:", err);
    }
  })();

  return;
}
